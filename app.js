const state = {
  railway: {
    name: 'サンプル線',
    number: '1',
    trainTypes: [{ name: '普通', code: 'F', category: 'Local' }],
  },
  stations: [
    { name: 'A駅', code: 'A' },
    { name: 'B駅', code: 'B' },
  ],
  timetable: [
    { trainNo: '101', type: '普通', station: 'A駅', arrive: '', depart: '08:00' },
    { trainNo: '101', type: '普通', station: 'B駅', arrive: '08:10', depart: '' },
  ],
};

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

function removeRowButton(onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'remove';
  btn.textContent = '削除';
  btn.addEventListener('click', onClick);
  return btn;
}

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

function renderRailway() {
  els.railwayName.value = state.railway.name;
  els.railwayNumber.value = state.railway.number;
  els.trainTypesTable.textContent = '';
  state.railway.trainTypes.forEach((type, idx) => {
    const currentIndex = idx;
    const tr = document.createElement('tr');
    tr.append(inputCell(type.name, value => (state.railway.trainTypes[currentIndex].name = value)));
    tr.append(inputCell(type.code, value => (state.railway.trainTypes[currentIndex].code = value)));
    tr.append(inputCell(type.category, value => (state.railway.trainTypes[currentIndex].category = value)));
    const td = document.createElement('td');
    td.append(removeRowButton(() => {
      state.railway.trainTypes.splice(currentIndex, 1);
      renderAll();
    }));
    tr.append(td);
    els.trainTypesTable.append(tr);
  });
}

function renderStations() {
  els.stationsTable.textContent = '';
  state.stations.forEach((station, idx) => {
    const currentIndex = idx;
    const tr = document.createElement('tr');
    tr.append(inputCell(station.name, value => (state.stations[currentIndex].name = value)));
    tr.append(inputCell(station.code, value => (state.stations[currentIndex].code = value)));
    const td = document.createElement('td');
    td.append(removeRowButton(() => {
      state.stations.splice(currentIndex, 1);
      renderAll();
    }));
    tr.append(td);
    els.stationsTable.append(tr);
  });
}

function renderTimetable() {
  els.timetableTable.textContent = '';
  state.timetable.forEach((row, idx) => {
    const currentIndex = idx;
    const tr = document.createElement('tr');
    tr.append(inputCell(row.trainNo, value => (state.timetable[currentIndex].trainNo = value)));
    tr.append(inputCell(row.type, value => (state.timetable[currentIndex].type = value)));
    tr.append(inputCell(row.station, value => (state.timetable[currentIndex].station = value)));
    tr.append(inputCell(row.arrive, value => (state.timetable[currentIndex].arrive = value)));
    tr.append(inputCell(row.depart, value => (state.timetable[currentIndex].depart = value)));
    const td = document.createElement('td');
    td.append(removeRowButton(() => {
      state.timetable.splice(currentIndex, 1);
      renderAll();
    }));
    tr.append(td);
    els.timetableTable.append(tr);
  });
}

function toMinutes(value) {
  if (!/^\d{1,2}:\d{2}$/.test(value || '')) return null;
  const [h, m] = value.split(':').map(Number);
  if (h < 0 || h > 29 || m < 0 || m > 59) return null;
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
    .map(row => ({ ...row, minute: toMinutes(row.depart || row.arrive) }))
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
  const palette = ['#1a4e8a', '#dd6b20', '#2f855a', '#b83280', '#805ad5'];
  lines.forEach((points, trainNo) => {
    const color = palette[colorIndex % palette.length];
    colorIndex += 1;
    const polyline = points
      .map(point => {
        const x = left + ((point.minute - minTime) / span) * (width - left - right);
        const y = top + stationNames.indexOf(point.station) * yStep;
        return `${x},${y}`;
      })
      .filter(v => !v.includes(',-') && !v.endsWith(',NaN'))
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
  const stations = ['[Stations]', ...data.stations.map(s => [s.name, s.code].join('|'))];
  const timetable = ['[Timetable]', ...data.timetable.map(r => [r.trainNo, r.type, r.station, r.arrive, r.depart].join('|'))];
  return [...header, ...trainTypes, ...stations, ...timetable].join('\n');
}

function parseOud2(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    if (parsed.railway && parsed.stations && parsed.timetable) {
      Object.assign(state, parsed);
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
      const [key, ...rest] = line.split('=');
      const value = rest.join('=').trim();
      if (key === 'Name') next.railway.name = value;
      if (key === 'Number') next.railway.number = value;
    } else if (section === 'TrainTypes') {
      const [name = '', code = '', category = ''] = line.split('|');
      if (name || code || category) next.railway.trainTypes.push({ name, code, category });
    } else if (section === 'Stations') {
      const [name = '', code = ''] = line.split('|');
      if (name || code) next.stations.push({ name, code });
    } else if (section === 'Timetable') {
      const [trainNo = '', type = '', station = '', arrive = '', depart = ''] = line.split('|');
      if (trainNo || station) next.timetable.push({ trainNo, type, station, arrive, depart });
    }
  });

  Object.assign(state, next);
}

function renderAll() {
  renderRailway();
  renderStations();
  renderTimetable();
  refreshDiagram();
}

document.getElementById('addTrainType').addEventListener('click', () => {
  state.railway.trainTypes.push({ name: '', code: '', category: '' });
  renderAll();
});

document.getElementById('addStation').addEventListener('click', () => {
  state.stations.push({ name: '', code: '' });
  renderAll();
});

document.getElementById('addTimetable').addEventListener('click', () => {
  state.timetable.push({ trainNo: '', type: '', station: '', arrive: '', depart: '' });
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
  link.download = `${state.railway.name || 'diagram'}.oud2`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

renderAll();
