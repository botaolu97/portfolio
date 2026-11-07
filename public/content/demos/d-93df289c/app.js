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
tiles.forEach((t) => t.addEventListener('click', () => {
  t.classList.toggle('selected');
}));

btn.import.addEventListener('click', () => {
  datasetCount++;
  const name = datasetCount === 1 ? 'sensor_data.csv' : `sensor_data_${datasetCount}.csv`;
  addRow($('dataList'), name, '10,000 rows');
  btn.train.disabled = false;
  btn.plot.disabled = false;
});

btn.train.addEventListener('click', () => {
  let picked = tiles.filter((t) => t.classList.contains('selected'));
  if (!picked.length) picked = tiles; // "Train All" with nothing selected trains every algo
  const list = $('algoList');
  picked.forEach((t) => {
    const name = t.dataset.algo;
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

btn.new.addEventListener('click', reset);

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
  tiles.forEach((t) => t.classList.remove('selected'));
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('collapsed'));
  [btn.plot, btn.train, btn.detect, btn.compare, btn.export].forEach((b) => (b.disabled = true));
  datasetCount = 0;
  plotCount = 0;
  docs = [];
  openDoc('Get Started', renderStart);
}

reset();
