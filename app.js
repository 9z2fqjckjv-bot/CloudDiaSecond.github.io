const TRAIN_OPERATIONS = ['停車', '通過', '運行なし'];
const DIAGRAM_DIRECTIONS = ['下り', '上り'];
const DEFAULT_TRAIN_OPERATION = '停車';
const DEFAULT_DIAGRAM_DIRECTION = '下り';
const MAX_RAILWAY_HOUR = 29;
const DIAGRAM_COLORS = ['#1a4e8a', '#dd6b20', '#2f855a', '#b83280', '#805ad5'];
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

const state = {
  railway: {
    name: 'サンプル線',
    number: '1',
    trainTypes: [{ name: '普通', code: 'F', category: 'Local' }],
  },
  stations: [
    { name: 'A駅', code: 'A', track: '1' },
    { name: 'B駅', code: 'B', track: '1' },
  ],
  diagrams: [
    {
      name: '下り1',
      direction: '下り',
      entries: [
        { trainNo: '101', station: 'A駅', arrive: '', depart: '08:00' },
        { trainNo: '101', station: 'B駅', arrive: '08:10', depart: '' },
      ],
    },
  ],
  trains: [
    {
      trainNo: '101',
      type: '普通',
      settings: [
        { station: 'A駅', operation: '停車', arriveTrack: '1', departTrack: '1', note: '' },
        { station: 'B駅', operation: '停車', arriveTrack: '1', departTrack: '1', note: '' },
      ],
    },
  ],
  ui: {
    selectedTrainIndex: 0,
  },
};

const els = {
  railwayName: document.getElementById('railwayName'),
  railwayNumber: document.getElementById('railwayNumber'),
  trainTypesTable: document.querySelector('#trainTypesTable tbody'),
  stationsTable: document.querySelector('#stationsTable tbody'),
  diagramsContainer: document.getElementById('diagramsContainer'),
  trainSelector: document.getElementById('trainSelector'),
  trainNoInput: document.getElementById('trainNoInput'),
  trainTypeInput: document.getElementById('trainTypeInput'),
  trainSettingsTable: document.querySelector('#trainSettingsTable tbody'),
  diagram: document.getElementById('diagram'),
  rawText: document.getElementById('rawText'),
  fileInput: document.getElementById('fileInput'),
};

function inputCell(value, onInput) {
  const input = document.createElement('input');
  input.value = value ?? '';
  input.addEventListener('input', e => {
    onInput(e.target.value);
    refreshDiagram();
  });
  const td = document.createElement('td');
  td.append(input);
  return td;
}

function selectCell(value, options, onInput) {
  const select = document.createElement('select');
  options.forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue || '—';
    select.append(option);
  });
  select.value = options.includes(value) ? value : options[0] ?? '';
  select.addEventListener('input', e => {
    onInput(e.target.value);
    refreshDiagram();
  });
  const td = document.createElement('td');
  td.append(select);
  return td;
}

function buttonCell(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', onClick);
  const td = document.createElement('td');
  td.append(button);
  return td;
}

function diagramOptions() {
  return [''].concat(state.trains.map(train => train.trainNo).filter(Boolean));
}

function stationOptions() {
  return [''].concat(state.stations.map(station => station.name).filter(Boolean));
}

function createDefaultTrain(trainNo = '') {
  return {
    trainNo,
    type: state.railway.trainTypes[0]?.name ?? '',
    settings: state.stations.map(station => createDefaultTrainSetting(station.name)),
  };
}

function createDefaultTrainSetting(stationName = '') {
  return {
    station: stationName,
    operation: DEFAULT_TRAIN_OPERATION,
    arriveTrack: '',
    departTrack: '',
    note: '',
  };
}

function createDefaultDiagram(name = `ダイヤ${state.diagrams.length + 1}`) {
  return {
    name,
    direction: DEFAULT_DIAGRAM_DIRECTION,
    entries: [],
  };
}

function createDefaultDiagramEntry() {
  return {
    trainNo: state.trains[0]?.trainNo ?? '',
    station: state.stations[0]?.name ?? '',
    arrive: '',
    depart: '',
  };
}

function normalizeStation(station = {}) {
  return {
    name: station.name ?? '',
    code: station.code ?? '',
    track: station.track ?? '',
  };
}

function normalizeDiagramEntry(entry = {}) {
  return {
    trainNo: entry.trainNo ?? '',
    station: entry.station ?? '',
    arrive: entry.arrive ?? '',
    depart: entry.depart ?? '',
  };
}

function normalizeDiagram(diagram = {}) {
  return {
    name: diagram.name ?? '',
    direction: DIAGRAM_DIRECTIONS.includes(diagram.direction) ? diagram.direction : DEFAULT_DIAGRAM_DIRECTION,
    entries: Array.isArray(diagram.entries) ? diagram.entries.map(normalizeDiagramEntry) : [],
  };
}

function normalizeTrainSetting(setting = {}, stationName = '') {
  const operation = TRAIN_OPERATIONS.includes(setting.operation) ? setting.operation : DEFAULT_TRAIN_OPERATION;
  return {
    station: setting.station ?? stationName,
    operation,
    arriveTrack: setting.arriveTrack ?? '',
    departTrack: setting.departTrack ?? '',
    note: setting.note ?? setting.remarks ?? '',
  };
}

function normalizeTrain(train = {}) {
  return {
    trainNo: train.trainNo ?? '',
    type: train.type ?? '',
    settings: Array.isArray(train.settings) ? train.settings.map(setting => normalizeTrainSetting(setting, setting.station ?? '')) : [],
  };
}

function buildTrainMap(inputState, diagrams) {
  const map = new Map();
  const addTrain = (trainNo, type = '') => {
    if (!trainNo) return;
    if (!map.has(trainNo)) {
      map.set(trainNo, normalizeTrain({ trainNo, type, settings: [] }));
      return;
    }
    if (!map.get(trainNo).type && type) map.get(trainNo).type = type;
  };

  if (Array.isArray(inputState.trains)) {
    inputState.trains.map(normalizeTrain).forEach(train => {
      addTrain(train.trainNo, train.type);
      const target = map.get(train.trainNo);
      if (target) target.settings = train.settings;
    });
  }

  diagrams.forEach(diagram => {
    diagram.entries.forEach(entry => addTrain(entry.trainNo, ''));
  });

  if (Array.isArray(inputState.timetable)) {
    inputState.timetable.forEach(row => addTrain(row.trainNo ?? '', row.type ?? ''));
  }

  if (Array.isArray(inputState.trainSettings)) {
    inputState.trainSettings.forEach(setting => addTrain(setting.trainNo ?? '', ''));
  }

  return map;
}

function syncTrainSettings(trains, stations, settingsSourceMap) {
  return trains.map(train => {
    const localMap = new Map();
    train.settings.forEach(setting => {
      const normalized = normalizeTrainSetting(setting, setting.station ?? '');
      localMap.set(normalized.station, normalized);
    });
    const settings = stations.map(station => {
      const byTrain = settingsSourceMap.get(`${train.trainNo}::${station.name}`);
      const existing = localMap.get(station.name);
      return normalizeTrainSetting(existing ?? byTrain ?? createDefaultTrainSetting(station.name), station.name);
    });
    return normalizeTrain({ ...train, settings });
  });
}

function normalizeState(inputState = {}) {
  const stations = Array.isArray(inputState.stations) ? inputState.stations.map(normalizeStation) : [];
  const diagrams = Array.isArray(inputState.diagrams) && inputState.diagrams.length
    ? inputState.diagrams.map(normalizeDiagram)
    : Array.isArray(inputState.timetable) && inputState.timetable.length
      ? [
          {
            name: 'ダイヤ1',
            direction: DEFAULT_DIAGRAM_DIRECTION,
            entries: inputState.timetable.map(row => normalizeDiagramEntry(row)),
          },
        ]
      : [];

  const trainMap = buildTrainMap(inputState, diagrams);
  const settingsSourceMap = new Map();

  if (Array.isArray(inputState.trainSettings)) {
    inputState.trainSettings.forEach(setting => {
      const normalized = normalizeTrainSetting(setting, setting.station ?? '');
      const trainNo = setting.trainNo ?? '';
      if (trainNo && normalized.station) settingsSourceMap.set(`${trainNo}::${normalized.station}`, normalized);
    });
  }

  if (Array.isArray(inputState.timetable)) {
    inputState.timetable.forEach(row => {
      if (!row.trainNo || !row.station) return;
      settingsSourceMap.set(
        `${row.trainNo}::${row.station}`,
        normalizeTrainSetting({ station: row.station, operation: row.operation }, row.station),
      );
    });
  }

  const trains = syncTrainSettings(Array.from(trainMap.values()), stations, settingsSourceMap);
  const selectedTrainIndex = Math.min(inputState.ui?.selectedTrainIndex ?? 0, Math.max(0, trains.length - 1));

  return {
    railway: {
      name: inputState.railway?.name ?? '',
      number: inputState.railway?.number ?? '',
      trainTypes: Array.isArray(inputState.railway?.trainTypes)
        ? inputState.railway.trainTypes.map(type => ({
            name: type.name ?? '',
            code: type.code ?? '',
            category: type.category ?? '',
          }))
        : [],
    },
    stations,
    diagrams,
    trains,
    ui: {
      selectedTrainIndex,
    },
  };
}

function replaceStationReferences(previousName, nextName) {
  state.diagrams.forEach(diagram => {
    diagram.entries.forEach(entry => {
      if (entry.station === previousName) entry.station = nextName;
    });
  });
  state.trains.forEach(train => {
    train.settings.forEach(setting => {
      if (setting.station === previousName) setting.station = nextName;
    });
  });
}

function replaceTrainReferences(previousTrainNo, nextTrainNo) {
  state.diagrams.forEach(diagram => {
    diagram.entries.forEach(entry => {
      if (entry.trainNo === previousTrainNo) entry.trainNo = nextTrainNo;
    });
  });
}

function syncStateAfterStationChange() {
  state.trains = syncTrainSettings(state.trains, state.stations, new Map());
  if (state.ui.selectedTrainIndex >= state.trains.length) {
    state.ui.selectedTrainIndex = Math.max(0, state.trains.length - 1);
  }
}

function renderRailway() {
  els.railwayName.value = state.railway.name;
  els.railwayNumber.value = state.railway.number;
  els.trainTypesTable.textContent = '';
  state.railway.trainTypes.forEach(type => {
    const findIndex = () => state.railway.trainTypes.indexOf(type);
    const tr = document.createElement('tr');
    tr.append(inputCell(type.name, value => {
      const index = findIndex();
      if (index >= 0) state.railway.trainTypes[index].name = value;
    }));
    tr.append(inputCell(type.code, value => {
      const index = findIndex();
      if (index >= 0) state.railway.trainTypes[index].code = value;
    }));
    tr.append(inputCell(type.category, value => {
      const index = findIndex();
      if (index >= 0) state.railway.trainTypes[index].category = value;
    }));
    tr.append(buttonCell('削除', 'remove', () => {
      const index = findIndex();
      if (index < 0) return;
      state.railway.trainTypes.splice(index, 1);
      renderAll();
    }));
    els.trainTypesTable.append(tr);
  });
}

function renderStations() {
  els.stationsTable.textContent = '';
  state.stations.forEach(station => {
    const findIndex = () => state.stations.indexOf(station);
    const tr = document.createElement('tr');
    tr.append(inputCell(station.name, value => {
      const index = findIndex();
      if (index < 0) return;
      const previousName = state.stations[index].name;
      state.stations[index].name = value;
      replaceStationReferences(previousName, value);
      syncStateAfterStationChange();
    }));
    tr.append(inputCell(station.code, value => {
      const index = findIndex();
      if (index >= 0) state.stations[index].code = value;
    }));
    tr.append(inputCell(station.track, value => {
      const index = findIndex();
      if (index >= 0) state.stations[index].track = value;
    }));
    tr.append(buttonCell('削除', 'remove', () => {
      const index = findIndex();
      if (index < 0) return;
      const removedName = state.stations[index].name;
      state.stations.splice(index, 1);
      state.diagrams.forEach(diagram => {
        diagram.entries = diagram.entries.filter(entry => entry.station !== removedName);
      });
      state.trains.forEach(train => {
        train.settings = train.settings.filter(setting => setting.station !== removedName);
      });
      syncStateAfterStationChange();
      renderAll();
    }));
    els.stationsTable.append(tr);
  });
}

function renderDiagrams() {
  els.diagramsContainer.textContent = '';
  if (!state.diagrams.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'ダイヤがありません。';
    els.diagramsContainer.append(p);
    return;
  }

  state.diagrams.forEach(diagram => {
    const findIndex = () => state.diagrams.indexOf(diagram);
    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-card';

    const heading = document.createElement('h3');
    heading.textContent = diagram.name || '名称未設定';
    wrapper.append(heading);

    const controls = document.createElement('div');
    controls.className = 'field-row';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'ダイヤ名 ';
    const nameInput = document.createElement('input');
    nameInput.value = diagram.name;
    nameInput.addEventListener('input', e => {
      const index = findIndex();
      if (index < 0) return;
      state.diagrams[index].name = e.target.value;
      heading.textContent = e.target.value || '名称未設定';
      refreshDiagram();
    });
    nameLabel.append(nameInput);
    controls.append(nameLabel);

    const directionLabel = document.createElement('label');
    directionLabel.textContent = '方向 ';
    const directionSelect = document.createElement('select');
    DIAGRAM_DIRECTIONS.forEach(direction => {
      const option = document.createElement('option');
      option.value = direction;
      option.textContent = direction;
      directionSelect.append(option);
    });
    directionSelect.value = diagram.direction;
    directionSelect.addEventListener('input', e => {
      const index = findIndex();
      if (index < 0) return;
      state.diagrams[index].direction = e.target.value;
      refreshDiagram();
    });
    directionLabel.append(directionSelect);
    controls.append(directionLabel);

    wrapper.append(controls);

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const addRowButton = document.createElement('button');
    addRowButton.type = 'button';
    addRowButton.textContent = '行を追加';
    addRowButton.addEventListener('click', () => {
      const index = findIndex();
      if (index < 0) return;
      state.diagrams[index].entries.push(createDefaultDiagramEntry());
      renderAll();
    });
    actions.append(addRowButton);

    const removeDiagramButton = document.createElement('button');
    removeDiagramButton.type = 'button';
    removeDiagramButton.className = 'remove';
    removeDiagramButton.textContent = 'ダイヤを削除';
    removeDiagramButton.addEventListener('click', () => {
      const index = findIndex();
      if (index < 0) return;
      state.diagrams.splice(index, 1);
      renderAll();
    });
    actions.append(removeDiagramButton);

    wrapper.append(actions);

    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>列車番号</th><th>駅名</th><th>着</th><th>発</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    diagram.entries.forEach(entry => {
      const findEntryIndex = () => {
        const diagramIndex = findIndex();
        return diagramIndex >= 0 ? state.diagrams[diagramIndex].entries.indexOf(entry) : -1;
      };
      const tr = document.createElement('tr');
      tr.append(selectCell(entry.trainNo, diagramOptions(), value => {
        const diagramIndex = findIndex();
        const entryIndex = findEntryIndex();
        if (diagramIndex >= 0 && entryIndex >= 0) state.diagrams[diagramIndex].entries[entryIndex].trainNo = value;
      }));
      tr.append(selectCell(entry.station, stationOptions(), value => {
        const diagramIndex = findIndex();
        const entryIndex = findEntryIndex();
        if (diagramIndex >= 0 && entryIndex >= 0) state.diagrams[diagramIndex].entries[entryIndex].station = value;
      }));
      tr.append(inputCell(entry.arrive, value => {
        const diagramIndex = findIndex();
        const entryIndex = findEntryIndex();
        if (diagramIndex >= 0 && entryIndex >= 0) state.diagrams[diagramIndex].entries[entryIndex].arrive = value;
      }));
      tr.append(inputCell(entry.depart, value => {
        const diagramIndex = findIndex();
        const entryIndex = findEntryIndex();
        if (diagramIndex >= 0 && entryIndex >= 0) state.diagrams[diagramIndex].entries[entryIndex].depart = value;
      }));
      tr.append(buttonCell('削除', 'remove', () => {
        const diagramIndex = findIndex();
        const entryIndex = findEntryIndex();
        if (diagramIndex < 0 || entryIndex < 0) return;
        state.diagrams[diagramIndex].entries.splice(entryIndex, 1);
        renderAll();
      }));
      tbody.append(tr);
    });

    table.append(tbody);
    wrapper.append(table);
    els.diagramsContainer.append(wrapper);
  });
}

function renderTrainEditor() {
  els.trainSelector.textContent = '';

  if (!state.trains.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '列車なし';
    els.trainSelector.append(option);
    els.trainNoInput.value = '';
    els.trainTypeInput.value = '';
    els.trainNoInput.disabled = true;
    els.trainTypeInput.disabled = true;
    els.trainSettingsTable.textContent = '';
    return;
  }

  state.ui.selectedTrainIndex = Math.min(state.ui.selectedTrainIndex, state.trains.length - 1);
  const selectedTrain = state.trains[state.ui.selectedTrainIndex];

  state.trains.forEach((train, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = train.trainNo || `列車${index + 1}`;
    els.trainSelector.append(option);
  });
  els.trainSelector.value = String(state.ui.selectedTrainIndex);

  els.trainNoInput.disabled = false;
  els.trainTypeInput.disabled = false;
  els.trainNoInput.value = selectedTrain.trainNo;
  els.trainTypeInput.value = selectedTrain.type;

  els.trainSettingsTable.textContent = '';
  selectedTrain.settings.forEach(setting => {
    const tr = document.createElement('tr');
    const stationCell = document.createElement('td');
    stationCell.textContent = setting.station;
    tr.append(stationCell);
    tr.append(selectCell(setting.operation, TRAIN_OPERATIONS, value => {
      setting.operation = value;
    }));
    tr.append(inputCell(setting.arriveTrack, value => {
      setting.arriveTrack = value;
    }));
    tr.append(inputCell(setting.departTrack, value => {
      setting.departTrack = value;
    }));
    tr.append(inputCell(setting.note, value => {
      setting.note = value;
    }));
    els.trainSettingsTable.append(tr);
  });
}

function toMinutes(value) {
  if (!/^\d{1,2}:\d{2}$/.test(value || '')) return null;
  const [h, m] = value.split(':').map(Number);
  if (h < 0 || h > MAX_RAILWAY_HOUR || m < 0 || m >= 60) return null;
  return h * 60 + m;
}

function refreshDiagram() {
  const width = 900;
  const sectionHeight = 240;
  const left = 80;
  const right = 20;
  const titleTop = 24;
  const top = 56;
  const bottom = 24;
  const diagrams = state.diagrams.length ? state.diagrams : [createDefaultDiagram('ダイヤなし')];
  const totalHeight = diagrams.length * sectionHeight;
  const stationNames = state.stations.map(station => station.name).filter(Boolean);
  const settingsMap = new Map();

  state.trains.forEach(train => {
    train.settings.forEach(setting => {
      settingsMap.set(`${train.trainNo}::${setting.station}`, setting);
    });
  });

  const parts = [`<rect x="0" y="0" width="${width}" height="${totalHeight}" fill="white"/>`];

  diagrams.forEach((diagram, diagramIndex) => {
    const offsetY = diagramIndex * sectionHeight;
    const yStep = stationNames.length > 1 ? (sectionHeight - top - bottom) / (stationNames.length - 1) : 0;
    const entries = diagram.entries
      .map(entry => {
        const normalized = normalizeDiagramEntry(entry);
        const setting = settingsMap.get(`${normalized.trainNo}::${normalized.station}`);
        return {
          ...normalized,
          operation: setting?.operation ?? DEFAULT_TRAIN_OPERATION,
          minute: toMinutes(normalized.depart || normalized.arrive),
        };
      })
      .filter(entry => entry.operation !== '運行なし')
      .filter(entry => entry.trainNo && entry.station && entry.minute !== null)
      .sort((a, b) => a.minute - b.minute);

    const minTime = entries.length ? entries[0].minute : 0;
    const maxTime = entries.length ? entries[entries.length - 1].minute : minTime + 60;
    const span = Math.max(1, maxTime - minTime);
    const lines = new Map();

    entries.forEach(entry => {
      if (!lines.has(entry.trainNo)) lines.set(entry.trainNo, []);
      lines.get(entry.trainNo).push(entry);
    });

    parts.push(`<text x="12" y="${offsetY + titleTop}" font-size="14" fill="#1d2733">${diagram.name || '名称未設定'}（${diagram.direction}）</text>`);
    parts.push(`<rect x="0" y="${offsetY}" width="${width}" height="${sectionHeight}" fill="none" stroke="#d6dee8"/>`);

    stationNames.forEach((name, idx) => {
      const y = offsetY + top + idx * yStep;
      parts.push(`<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#d6dee8"/>`);
      parts.push(`<text x="8" y="${y + 4}" font-size="12">${name}</text>`);
    });

    let colorIndex = 0;
    lines.forEach((points, trainNo) => {
      const color = DIAGRAM_COLORS[colorIndex % DIAGRAM_COLORS.length];
      colorIndex += 1;
      const polyline = points
        .slice()
        .sort((a, b) => a.minute - b.minute)
        .map(point => {
          const stationIndex = stationNames.indexOf(point.station);
          if (stationIndex < 0) return null;
          const x = left + ((point.minute - minTime) / span) * (width - left - right);
          const y = offsetY + top + stationIndex * yStep;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          return `${x},${y}`;
        })
        .filter(Boolean)
        .join(' ');

      if (!polyline) return;
      parts.push(`<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2"/>`);
      const first = polyline.split(' ')[0];
      if (first) {
        const [x, y] = first.split(',');
        parts.push(`<text x="${Number(x) + 4}" y="${Number(y) - 6}" font-size="11" fill="${color}">${trainNo}</text>`);
      }
    });
  });

  els.diagram.setAttribute('viewBox', `0 0 ${width} ${totalHeight}`);
  els.diagram.innerHTML = parts.join('');
  els.rawText.value = serializeOud2(state);
}

function serializeOud2(data) {
  const header = ['# CloudDiaSecond OUD2', '[Railway]', `Name=${data.railway.name}`, `Number=${data.railway.number}`];
  const trainTypes = ['[TrainTypes]', ...data.railway.trainTypes.map(type => [type.name, type.code, type.category].join('|'))];
  const stations = ['[Stations]', ...data.stations.map(station => [station.name, station.code, station.track].join('|'))];
  const diagrams = ['[Diagrams]', ...data.diagrams.map(diagram => [diagram.name, diagram.direction].join('|'))];
  const diagramEntries = [
    '[DiagramEntries]',
    ...data.diagrams.flatMap(diagram => diagram.entries.map(entry => [diagram.name, entry.trainNo, entry.station, entry.arrive, entry.depart].join('|'))),
  ];
  const trains = ['[Trains]', ...data.trains.map(train => [train.trainNo, train.type].join('|'))];
  const trainSettings = [
    '[TrainSettings]',
    ...data.trains.flatMap(train =>
      train.settings.map(setting => [train.trainNo, setting.station, setting.operation, setting.arriveTrack, setting.departTrack, setting.note].join('|')),
    ),
  ];
  return [...header, ...trainTypes, ...stations, ...diagrams, ...diagramEntries, ...trains, ...trainSettings].join('\n');
}

function parseOud2(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('入力テキストが空です。.oud2内容を入力するかファイルを選択してください。');

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    Object.assign(state, normalizeState(parsed));
    return;
  }

  const next = {
    railway: { name: '', number: '', trainTypes: [] },
    stations: [],
    diagrams: [],
    trains: [],
    trainSettings: [],
    timetable: [],
  };

  const diagramMap = new Map();
  let section = '';

  trimmed.split(/\r?\n/).forEach(line => {
    if (!line || line.startsWith('#')) return;
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      return;
    }

    if (section === 'Railway') {
      const [rawKey, ...rest] = line.split('=');
      const key = rawKey.trim();
      const value = rest.join('=').trim();
      if (key === 'Name') next.railway.name = value;
      if (key === 'Number') next.railway.number = value;
    } else if (section === 'TrainTypes') {
      const [name = '', code = '', category = ''] = line.split('|');
      if (name || code || category) next.railway.trainTypes.push({ name, code, category });
    } else if (section === 'Stations') {
      const [name = '', code = '', track = ''] = line.split('|');
      if (name || code) next.stations.push({ name, code, track });
    } else if (section === 'Diagrams') {
      const [name = '', direction = DEFAULT_DIAGRAM_DIRECTION] = line.split('|');
      if (!name) return;
      const diagram = normalizeDiagram({ name, direction, entries: [] });
      diagramMap.set(name, diagram);
      next.diagrams.push(diagram);
    } else if (section === 'DiagramEntries') {
      const [diagramName = '', trainNo = '', station = '', arrive = '', depart = ''] = line.split('|');
      if (!diagramName) return;
      if (!diagramMap.has(diagramName)) {
        const diagram = normalizeDiagram({ name: diagramName, direction: DEFAULT_DIAGRAM_DIRECTION, entries: [] });
        diagramMap.set(diagramName, diagram);
        next.diagrams.push(diagram);
      }
      diagramMap.get(diagramName).entries.push({ trainNo, station, arrive, depart });
    } else if (section === 'Trains') {
      const [trainNo = '', type = ''] = line.split('|');
      if (trainNo || type) next.trains.push({ trainNo, type, settings: [] });
    } else if (section === 'TrainSettings') {
      const [trainNo = '', station = '', operation = DEFAULT_TRAIN_OPERATION, arriveTrack = '', departTrack = '', note = ''] = line.split('|');
      if (trainNo || station) next.trainSettings.push({ trainNo, station, operation, arriveTrack, departTrack, note });
    } else if (section === 'Timetable') {
      const [trainNo = '', type = '', station = '', arrive = '', depart = '', operation = DEFAULT_TRAIN_OPERATION] = line.split('|');
      if (trainNo || station) next.timetable.push({ trainNo, type, station, arrive, depart, operation });
    }
  });

  Object.assign(state, normalizeState(next));
}

function renderAll() {
  renderRailway();
  renderStations();
  renderDiagrams();
  renderTrainEditor();
  refreshDiagram();
}

function sanitizeFilename(name) {
  const sanitized = (name || '').replace(INVALID_FILENAME_CHARS, '_').trim();
  return sanitized || 'diagram';
}

document.getElementById('addTrainType').addEventListener('click', () => {
  state.railway.trainTypes.push({ name: '', code: '', category: '' });
  renderAll();
});

document.getElementById('addStation').addEventListener('click', () => {
  const stationName = `駅${state.stations.length + 1}`;
  state.stations.push({ name: stationName, code: '', track: '' });
  syncStateAfterStationChange();
  renderAll();
});

document.getElementById('addDiagram').addEventListener('click', () => {
  state.diagrams.push(createDefaultDiagram(`ダイヤ${state.diagrams.length + 1}`));
  renderAll();
});

document.getElementById('addTrain').addEventListener('click', () => {
  state.trains.push(createDefaultTrain(`列車${state.trains.length + 1}`));
  state.ui.selectedTrainIndex = state.trains.length - 1;
  renderAll();
});

document.getElementById('removeTrain').addEventListener('click', () => {
  if (!state.trains.length) return;
  const [removed] = state.trains.splice(state.ui.selectedTrainIndex, 1);
  if (removed?.trainNo) {
    state.diagrams.forEach(diagram => {
      diagram.entries = diagram.entries.filter(entry => entry.trainNo !== removed.trainNo);
    });
  }
  state.ui.selectedTrainIndex = Math.max(0, Math.min(state.ui.selectedTrainIndex, state.trains.length - 1));
  renderAll();
});

els.trainSelector.addEventListener('input', e => {
  state.ui.selectedTrainIndex = Number(e.target.value) || 0;
  renderTrainEditor();
});

els.trainNoInput.addEventListener('input', e => {
  const train = state.trains[state.ui.selectedTrainIndex];
  if (!train) return;
  const previousTrainNo = train.trainNo;
  train.trainNo = e.target.value;
  replaceTrainReferences(previousTrainNo, train.trainNo);
  renderAll();
});

els.trainTypeInput.addEventListener('input', e => {
  const train = state.trains[state.ui.selectedTrainIndex];
  if (!train) return;
  train.type = e.target.value;
  refreshDiagram();
});

els.railwayName.addEventListener('input', e => {
  state.railway.name = e.target.value;
  refreshDiagram();
});

els.railwayNumber.addEventListener('input', e => {
  state.railway.number = e.target.value;
  refreshDiagram();
});

document.getElementById('importBtn').addEventListener('click', async () => {
  const file = els.fileInput.files?.[0];
  const text = file ? await file.text() : els.rawText.value;
  try {
    parseOud2(text);
    renderAll();
  } catch (error) {
    alert(`インポートに失敗しました: ${error.message}`);
  }
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([serializeOud2(state)], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${sanitizeFilename(state.railway.name)}.oud2`;
  link.click();
  URL.revokeObjectURL(url);
});

renderAll();
