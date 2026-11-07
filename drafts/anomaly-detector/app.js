// Anomaly Detector: low-fi prototype. Plain JS, no storage.
const $ = (id) => document.getElementById(id);
const btn = {
  new: $('btnNew'), plot: $('btnPlot'), train: $('btnTrain'),
  import: $('btnImport'), detect: $('btnDetect'), compare: $('btnCompare'), export: $('btnExport'),
};
const tiles = [...document.querySelectorAll('.tile')];
let docs = [];       // { id, title, render() }
let activeId = null;
let plotCount = 0;
let datasetCount = 0;

/* ---------- Ribbon ---------- */
const selected = new Set();
tiles.forEach((t) => t.addEventListener('click', () => toggleAlgo(t.dataset.algo)));

function toggleAlgo(name) {
  selected.has(name) ? selected.delete(name) : selected.add(name);
  drawSelection();
}
function drawSelection() {
  document.querySelectorAll('[data-algo]').forEach((t) => t.classList.toggle('selected', selected.has(t.dataset.algo)));
}

btn.import.addEventListener('click', () => {
  datasetCount++;
  const name = datasetCount === 1 ? 'sensor_data.csv' : `sensor_data_${datasetCount}.csv`;
  addRow($('dataList'), name, '10,000 rows');
  btn.train.disabled = false;
  btn.plot.disabled = false;
});

btn.train.addEventListener('click', () => {
  // "Train All" with nothing selected trains the three ribbon algorithms
  const picked = selected.size ? [...selected] : tiles.map((t) => t.dataset.algo);
  const list = $('algoList');
  picked.forEach((name) => {
    if (!list.querySelector(`[data-name="${name}"]`)) addRow(list, name, 'trained', true);
  });
  btn.detect.disabled = false;
});

btn.detect.addEventListener('click', () => {
  btn.compare.disabled = false;
  btn.export.disabled = false;
  $('algoList').querySelectorAll('.sub').forEach((s) => (s.textContent = 'trained · 12 anomalies'));
});

btn.compare.addEventListener('click', () => alert('Compare: not designed yet.'));
btn.export.addEventListener('click', () => alert('Export: not designed yet.'));
$('btnOpen').addEventListener('click', () => alert('Open session: not designed yet.'));
$('btnSave').addEventListener('click', () => alert('Save session: not designed yet.'));

btn.plot.addEventListener('click', () => {
  plotCount++;
  openDoc(`Plot ${plotCount}`, renderPlot);
});

btn.new.addEventListener('click', openNewSession);

function addRow(list, name, sub, done) {
  const li = document.createElement('li');
  li.dataset.name = name;
  li.innerHTML = `<span class="dot${done ? ' done' : ''}"></span><span>${name}</span><span class="sub">· ${sub}</span>`;
  list.appendChild(li);
}

/* ---------- Left panels ---------- */
document.querySelectorAll('.panel .toggle').forEach((tg) => tg.addEventListener('click', () => {
  const p = tg.closest('.panel');
  p.classList.toggle('collapsed');
  tg.setAttribute('aria-label', p.classList.contains('collapsed') ? 'Expand' : 'Collapse');
}));

/* ---------- Documents ---------- */
function openDoc(title, render) {
  const id = 'doc' + Math.random().toString(36).slice(2, 8);
  docs.push({ id, title, render });
  activeId = id;
  drawDocs();
}

function closeDoc(id) {
  const i = docs.findIndex((d) => d.id === id);
  docs.splice(i, 1);
  if (activeId === id) activeId = docs.length ? docs[Math.max(0, i - 1)].id : null;
  drawDocs();
}

function drawDocs() {
  const tabs = $('docTabs');
  const area = $('docArea');
  tabs.innerHTML = '';
  area.innerHTML = '';
  if (!docs.length) {
    area.innerHTML = '<div class="empty">No documents open. Import data and click Plot to start.</div>';
    return;
  }
  docs.forEach((d) => {
    const tab = document.createElement('div');
    tab.className = 'doctab' + (d.id === activeId ? ' active' : '');
    tab.innerHTML = `<span>${d.title}</span><button class="x" aria-label="Close">×</button>`;
    tab.addEventListener('click', () => { activeId = d.id; drawDocs(); });
    tab.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); closeDoc(d.id); });
    tabs.appendChild(tab);

    const page = document.createElement('div');
    page.className = 'page' + (d.id === activeId ? ' active' : '');
    page.innerHTML = d.render();
    area.appendChild(page);
  });
}

function renderStart() {
  return '<h2>Get Started</h2><p>1. Import Data to load a data set.</p><p>2. Pick algorithms and Train All.</p><p>3. Detect anomalies, then Compare or Export.</p>';
}

function renderPlot() {
  // Simple deterministic wavy series with a few spikes as "anomalies".
  const W = 600, H = 220, n = 80;
  const pts = [];
  for (let i = 0; i < n; i++) {
    let y = 110 + Math.sin(i / 5) * 40 + Math.sin(i * 1.7) * 8;
    if (i === 23 || i === 51 || i === 66) y -= 70;
    pts.push([20 + (i * (W - 40)) / (n - 1), y]);
  }
  const line = pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  const spikes = [23, 51, 66].map((i) => `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="4" fill="none" stroke="#c44"/>`).join('');
  return `<h2>sensor_data.csv</h2>
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <rect x="20" y="10" width="${W - 40}" height="${H - 30}" fill="none" stroke="#ccc"/>
      <path d="M20 ${H - 60}H${W - 20}M20 ${H - 120}H${W - 20}" stroke="#eee"/>
      <polyline points="${line}" fill="none" stroke="#555" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
      ${spikes}
    </svg>`;
}

function reset() {
  $('dataList').innerHTML = '';
  $('algoList').innerHTML = '';
  selected.clear();
  drawSelection();
  closeGallery();
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('collapsed'));
  [btn.plot, btn.train, btn.detect, btn.compare, btn.export].forEach((b) => (b.disabled = true));
  datasetCount = 0;
  plotCount = 0;
  docs = [];
  openDoc('Get Started', renderStart);
}


/* ---------- New Session dialog ---------- */
const WORKSPACE = {
  ecgSignals: ['ecgSignals1', 'ecgSignals2', 'ecgSignals3'],
  vibrationData: ['vibration1', 'vibration2'],
  pumpSensors: ['pumpPressure', 'pumpFlow', 'pumpTemp', 'pumpCurrent'],
};
const FILE_SIGNALS = ['signal1', 'signal2'];
const LABELS = ['None', 'labels', 'isAnomaly'];
const dlg = $('dlgNew');
let staged = []; // { name, label }

Object.keys(WORKSPACE).forEach((k) => $('selDataset').add(new Option(k, k)));
$('selDataset').addEventListener('change', drawSignals);
document.querySelectorAll('input[name="src"]').forEach((r) => r.addEventListener('change', () => {
  const file = source() === 'file';
  $('srcWorkspace').hidden = file;
  $('srcFile').hidden = !file;
  drawSignals();
}));
$('btnBrowse').addEventListener('click', () => { $('fileName').value = 'recording_01.mat'; drawSignals(); });
$('btnAddList').addEventListener('click', () => {
  document.querySelectorAll('#signalList input:checked').forEach((c) => {
    if (!staged.some((d) => d.name === c.value)) staged.push({ name: c.value, label: 'None' });
    c.checked = false;
  });
  drawStaged();
});
$('btnHelp').addEventListener('click', () => alert('Help: not designed yet.'));
dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeNewSession));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.hidden) closeNewSession(); });
$('btnDlgImport').addEventListener('click', () => {
  const sets = staged.slice();
  closeNewSession();
  reset();
  sets.forEach((d) => addRow($('dataList'), d.name, d.label === 'None' ? 'unlabeled' : `label: ${d.label}`));
  datasetCount = sets.length;
  if (sets.length) { btn.train.disabled = false; btn.plot.disabled = false; }
});

function source() { return document.querySelector('input[name="src"]:checked').value; }

function openNewSession() {
  staged = [];
  document.querySelector('input[name="src"][value="workspace"]').click();
  $('selDataset').value = 'ecgSignals';
  $('fileName').value = '';
  drawSignals();
  $('signalList').querySelector('input')?.click();
  drawStaged();
  dlg.hidden = false;
}

function closeNewSession() { dlg.hidden = true; }

function drawSignals() {
  const names = source() === 'file' ? ($('fileName').value ? FILE_SIGNALS : []) : WORKSPACE[$('selDataset').value];
  const box = $('signalList');
  box.innerHTML = names.length
    ? names.map((n) => `<label class="signal"><input type="checkbox" value="${n}">${n}</label>`).join('')
    : '<div class="nosig">Choose a file to list its signals.</div>';
  $('btnAddList').disabled = !names.length;
}

function drawStaged() {
  const rows = $('dsRows');
  rows.innerHTML = '';
  staged.forEach((d, i) => {
    const r = document.createElement('div');
    r.className = 'drow';
    r.innerHTML = `<span>${d.name}</span><select>${LABELS.map((l) => `<option${l === d.label ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="del" aria-label="Remove ${d.name}">&times;</button>`;
    r.querySelector('select').addEventListener('change', (e) => { d.label = e.target.value; });
    r.querySelector('.del').addEventListener('click', () => { staged.splice(i, 1); drawStaged(); });
    rows.appendChild(r);
  });
}

/* ---------- Algorithm gallery popup ---------- */
const CATEGORIES = [
  { id: 'dl', title: 'DEEP LEARNING', algos: ['tcnAD', 'deepantAD', 'usAD', 'vaelstmAD', 'iforest'] },
  { id: 'ml', title: 'MACHINE LEARNING', algos: ['rrcforest', 'lof', 'ocsvm'] },
];
const favorites = ['tcnAD', 'rrcforest'];
const collapsed = new Set();
const pop = $('galPop');
const TILE_SVG = '<svg viewBox="0 0 24 24"><rect x=".5" y=".5" width="23" height="23" fill="#fff" stroke="#555"/><path d="M1 1l22 22M23 1L1 23" stroke="#555"/></svg>';

$('btnMore').addEventListener('click', (e) => { e.stopPropagation(); pop.hidden ? openGallery() : closeGallery(); });
document.addEventListener('mousedown', (e) => {
  if (!pop.hidden && !pop.contains(e.target) && !$('btnMore').contains(e.target)) closeGallery();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) closeGallery(); });

function openGallery() {
  const g = document.querySelector('.gallery').getBoundingClientRect();
  pop.style.left = g.left + 'px';
  pop.style.top = g.bottom - 1 + 'px';
  pop.style.width = g.width + 'px';
  pop.hidden = false;
  $('btnMore').setAttribute('aria-expanded', 'true');
  drawGallery();
}
function closeGallery() {
  pop.hidden = true;
  $('btnMore').setAttribute('aria-expanded', 'false');
}

function drawGallery() {
  const sections = [{ id: 'fav', title: 'FAVORITE', algos: favorites }, ...CATEGORIES];
  pop.innerHTML = sections.map((s, i) => `
    <section class="gsec${collapsed.has(s.id) ? ' collapsed' : ''}" data-sec="${s.id}">
      <header><button class="gtitle">${s.title}</button>${i === 1 ? '<span class="gall"><button data-all="collapse" title="Collapse all">' + chev(true) + '</button><button data-all="expand" title="Expand all">' + chev(false) + '</button></span>' : ''}</header>
      <div class="gtiles">${s.algos.length ? s.algos.map((a) => `
        <div class="gtile" data-algo="${a}" role="button" tabindex="0">${TILE_SVG}<span>${a}</span>
          <button class="star${favorites.includes(a) ? ' on' : ''}" title="${favorites.includes(a) ? 'Remove from' : 'Add to'} favorites">${starSvg()}</button></div>`).join('')
        : '<div class="gempty">Star an algorithm to add it here.</div>'}</div>
    </section>`).join('');
  drawSelection();
  pop.querySelectorAll('.gtile').forEach((t) => t.addEventListener('click', () => toggleAlgo(t.dataset.algo)));
  pop.querySelectorAll('.star').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const a = b.closest('.gtile').dataset.algo;
    const i = favorites.indexOf(a);
    i >= 0 ? favorites.splice(i, 1) : favorites.push(a);
    drawGallery();
  }));
  pop.querySelectorAll('.gtitle').forEach((b) => b.addEventListener('click', () => {
    const id = b.closest('.gsec').dataset.sec;
    collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
    drawGallery();
  }));
  pop.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => {
    sections.forEach((s) => (b.dataset.all === 'collapse' ? collapsed.add(s.id) : collapsed.delete(s.id)));
    drawGallery();
  }));
}
function chev(up) {
  const d = up ? 'M2 6l4-4 4 4zM2 11l4-4 4 4z' : 'M2 2h8l-4 4zM2 7h8l-4 4z';
  return `<svg viewBox="0 0 12 13"><path d="${d}" fill="none" stroke="#666"/></svg>`;
}
function starSvg() {
  return '<svg viewBox="0 0 16 16"><path d="M8 1.5l1.9 4.2 4.6.4-3.5 3 1.1 4.5L8 11.2l-4.1 2.4L5 9.1l-3.5-3 4.6-.4z"/></svg>';
}

reset();
