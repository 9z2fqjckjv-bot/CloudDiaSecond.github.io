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
  timetable: [
    { trainNo: '101', type: '普通', station: 'A駅', arrive: '', depart: '08:00', operation: '停車' },
    { trainNo: '101', type: '普通', station: 'B駅', arrive: '08:10', depart: '', operation: '停車' },
  ],
};
const MAX_RAILWAY_HOUR = 29;
const DIAGRAM_COLORS = ['#1a4e8a', '#dd6b20', '#2f855a', '#b83280', '#805ad5'];
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const TRAIN_OPERATIONS = ['停車', '通過', '運行なし'];
const DEFAULT_TRAIN_OPERATION = '停車';

const els = {
  railwayName: document.getElementById('railwayName'),
  railwayNumber: document.getElementById('railwayNumber'),
  trainTypesTable: document.querySelector('#trainTypesTable tbody'),
  stationsTable: document.querySelector('#stationsTable tbody'),
  timetableTable: document.querySelector('#timetableTable tbody'),
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
    option.textContent = optionValue;
    select.append(option);
  });
  select.value = options.includes(value) ? value : options[0];
  select.addEventListener('input', e => {
    onInput(e.target.value);
    refreshDiagram();
  });
  const td = document.createElement('td');
  td.append(select);
  return td;
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
      if (index >= 0) state.stations[index].name = value;
    }));
    tr.append(inputCell(station.code, value => {
      const index = findIndex();
      if (index >= 0) state.stations[index].code = value;
    }));
    tr.append(inputCell(station.track, value => {
      const index = findIndex();
      if (index >= 0) state.stations[index].track = value;
    }));
    els.stationsTable.append(tr);
  });
}

function renderTimetable() {
  els.timetableTable.textContent = '';
  state.timetable.forEach(row => {
    const findIndex = () => state.timetable.indexOf(row);
    const tr = document.createElement('tr');
    tr.append(inputCell(row.trainNo, value => {
      const index = findIndex();
      if (index >= 0) state.timetable[index].trainNo = value;
    }));
    tr.append(inputCell(row.type, value => {
      const index = findIndex();
      if (index >= 0) state.timetable[index].type = value;
    }));
    tr.append(inputCell(row.station, value => {
      const index = findIndex();
      if (index >= 0) state.timetable[index].station = value;
    }));
    tr.append(inputCell(row.arrive, value => {
      const index = findIndex();
      if (index >= 0) state.timetable[index].arrive = value;
    }));
    tr.append(inputCell(row.depart, value => {
      const index = findIndex();
      if (index >= 0) state.timetable[index].depart = value;
    }));
    tr.append(selectCell(row.operation, TRAIN_OPERATIONS, value => {
      const index = findIndex();
      if (index >= 0) state.timetable[index].operation = value;
    }));
    els.timetableTable.append(tr);
  });
}

function toMinutes(value) {
  if (!/^\d{1,2}:\d{2}$/.test(value || '')) return null;
  const [h, m] = value.split(':').map(Number);
  // 鉄道ダイヤでは日跨ぎ運転を想定し 29:59 までを許容
  if (h < 0 || h > MAX_RAILWAY_HOUR || m < 0 || m >= 60) return null;
  return h * 60 + m;
}

function refreshDiagram() {
  const width = 900;
  const height = 400;
  const left = 80;
  const right = 20;
  const top = 20;
  const bottom = 20;
  const stationNames = state.stations.map(s => s.name).filter(Boolean);
  const yStep = stationNames.length > 1 ? (height - top - bottom) / (stationNames.length - 1) : 0;

  const entries = state.timetable
    .map(row => {
      const normalized = normalizeTimetableRow(row);
      return { ...normalized, minute: toMinutes(normalized.depart || normalized.arrive) };
    })
    .filter(row => row.operation !== '運行なし')
    .filter(row => row.trainNo && row.station && row.minute !== null)
    .sort((a, b) => a.minute - b.minute);

  const minTime = entries.length ? entries[0].minute : 0;
  const maxTime = entries.length ? entries[entries.length - 1].minute : minTime + 60;
  const span = Math.max(1, maxTime - minTime);

  const lines = new Map();
  entries.forEach(entry => {
    if (!lines.has(entry.trainNo)) lines.set(entry.trainNo, []);
    lines.get(entry.trainNo).push(entry);
  });

  const parts = [
    `<rect x="0" y="0" width="${width}" height="${height}" fill="white"/>`,
  ];

  stationNames.forEach((name, idx) => {
    const y = top + idx * yStep;
    parts.push(`<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#d6dee8"/>`);
    parts.push(`<text x="8" y="${y + 4}" font-size="12">${name}</text>`);
  });

  let colorIndex = 0;
  lines.forEach((points, trainNo) => {
    const color = DIAGRAM_COLORS[colorIndex % DIAGRAM_COLORS.length];
    colorIndex += 1;
    const polyline = points
      .map(point => {
        const x = left + ((point.minute - minTime) / span) * (width - left - right);
        const y = top + stationNames.indexOf(point.station) * yStep;
        const isFinitePoint = Number.isFinite(x) && Number.isFinite(y);
        const isInDiagramBounds = x >= left && y >= top;
        if (!isFinitePoint || !isInDiagramBounds) return null;
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

  els.diagram.innerHTML = parts.join('');
  els.rawText.value = serializeOud2(state);
}

function serializeOud2(data) {
  const header = ['# CloudDiaSecond OUD2', '[Railway]', `Name=${data.railway.name}`, `Number=${data.railway.number}`];
  const trainTypes = ['[TrainTypes]', ...data.railway.trainTypes.map(t => [t.name, t.code, t.category].join('|'))];
  const stations = ['[Stations]', ...data.stations.map(s => [s.name, s.code, s.track].join('|'))];
  const timetable = ['[Timetable]', ...data.timetable.map(r => [r.trainNo, r.type, r.station, r.arrive, r.depart, r.operation].join('|'))];
  return [...header, ...trainTypes, ...stations, ...timetable].join('\n');
}

function normalizeStation(station = {}) {
  return {
    name: station.name ?? '',
    code: station.code ?? '',
    track: station.track ?? '',
  };
}

function normalizeTimetableRow(row = {}) {
  const operation = TRAIN_OPERATIONS.includes(row.operation) ? row.operation : DEFAULT_TRAIN_OPERATION;
  return {
    trainNo: row.trainNo ?? '',
    type: row.type ?? '',
    station: row.station ?? '',
    arrive: row.arrive ?? '',
    depart: row.depart ?? '',
    operation,
  };
}

function normalizeState(inputState) {
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
    stations: Array.isArray(inputState.stations) ? inputState.stations.map(normalizeStation) : [],
    timetable: Array.isArray(inputState.timetable) ? inputState.timetable.map(normalizeTimetableRow) : [],
  };
}

function parseOud2(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('入力テキストが空です。.oud2内容を入力するかファイルを選択してください。');

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    if (parsed.railway && parsed.stations && parsed.timetable) {
      Object.assign(state, normalizeState(parsed));
      return;
    }
  }

  const next = {
    railway: { name: '', number: '', trainTypes: [] },
    stations: [],
    timetable: [],
  };

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
  renderTimetable();
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
  state.stations.push({ name: '', code: '', track: '' });
  renderAll();
});

document.getElementById('addTimetable').addEventListener('click', () => {
  state.timetable.push({ trainNo: '', type: '', station: '', arrive: '', depart: '', operation: DEFAULT_TRAIN_OPERATION });
  renderAll();
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

document.addEventListener('keydown', e => {
  if (e.key !== 'D' || !e.shiftKey) return;
  const tr = e.target.closest('tr');
  if (!tr) return;
  const tbody = tr.parentElement;
  const rowIndex = Array.from(tbody.rows).indexOf(tr);
  if (rowIndex < 0) return;
  if (tbody === els.trainTypesTable) {
    state.railway.trainTypes.splice(rowIndex, 1);
  } else if (tbody === els.stationsTable) {
    state.stations.splice(rowIndex, 1);
  } else if (tbody === els.timetableTable) {
    state.timetable.splice(rowIndex, 1);
  } else {
    return;
  }
  renderAll();
});

renderAll();
