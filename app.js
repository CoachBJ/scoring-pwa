// ----- Scoring definitions -----
const SCORING_PLAYS = [
  { pts: 8, label: "TD + 2pt" },
  { pts: 7, label: "TD + PAT" },
  { pts: 6, label: "TD (no conv)" },
  { pts: 3, label: "FG" },
  { pts: 2, label: "Safety" },
];

// ----- Core: build all unique combos that sum to target -----
function scoreCombos(target) {
  const plays = SCORING_PLAYS;
  const combos = [];
  const counts = new Array(plays.length).fill(0);
  function dfs(rem, startIdx) {
    if (rem === 0) { combos.push([...counts]); return; }
    for (let i = startIdx; i < plays.length; i++) {
      if (plays[i].pts > rem) continue;
      counts[i]++; dfs(rem - plays[i].pts, i); counts[i]--;
    }
  }
  dfs(target, 0);
  return combos;
}

function rankKey(counts) {
  const totalPlays = counts.reduce((a,b)=>a+b,0);
  return [ totalPlays, -counts[0], -counts[1], -counts[2], counts[3], counts[4] ];
}

function formatCombo(counts) {
  const parts = [];
  for (let i=0;i<counts.length;i++){
    const c = counts[i];
    if (!c) continue;
    const label = (c>1? `${c}x ${SCORING_PLAYS[i].label}` : SCORING_PLAYS[i].label);
    parts.push(label);
  }
  return parts.join(" + ");
}

function validateDeficit(d) {
  if (d === "" || d == null) return { ok:false, msg:"" };
  const n = Math.floor(Number(d));
  if (Number.isNaN(n)) return { ok:false, msg:"#VALUE!" };
  if (n <= 0) return { ok:false, msg:"Tied or Ahead" };
  return { ok:true, n };
}

// ----- UI -----
const elDeficit = document.querySelector('#deficit');
const elCap = document.querySelector('#cap');
const elCalc = document.querySelector('#calc');
const elOutput = document.querySelector('#output');
const elStatus = document.querySelector('#status');
const viewTable = document.querySelector('#view-table');
const viewRow   = document.querySelector('#view-row');

elCalc.addEventListener('click', run);
elDeficit.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

function run() {
  elOutput.innerHTML = '';
  elStatus.textContent = '';

  const v = validateDeficit(elDeficit.value.trim());
  if (!v.ok) {
    if (v.msg) elStatus.textContent = v.msg;
    return;
  }
  const cap = Math.max(1, Number(elCap.value || 200));
  const combos = scoreCombos(v.n);
  if (!combos.length) { elStatus.textContent = "Not reachable with standard scoring"; return; }

  const items = combos
    .map(cs => ({ cs, key: rankKey(cs), txt: formatCombo(cs), plays: cs.reduce((a,b)=>a+b,0) }))
    .sort((a,b) => {
      for (let i=0;i<a.key.length;i++) if (a.key[i] !== b.key[i]) return a.key[i]-b.key[i];
      return a.txt.localeCompare(b.txt);
    });

  const seen = new Set();
  const filtered = [];
  for (const it of items) {
    if (seen.has(it.txt)) continue;
    seen.add(it.txt);
    filtered.push(it);
    if (filtered.length >= cap) break;
  }

  if (viewTable.checked) renderTable(filtered);
  else renderRow(filtered);

  elStatus.textContent = `Found ${filtered.length} option${filtered.length===1?'':'s'}.`;
}

function renderRow(list) {
  const card = document.createElement('div');
  card.className = 'card';
  const row = document.createElement('div');

  list.forEach((it, idx) => {
    const wrap = document.createElement('span');
    wrap.className = 'wrap';
    const segments = it.txt.split(' + ');
    segments.forEach(seg => {
      const span = document.createElement('span');
      span.className = 'segment';
      span.textContent = seg;
      wrap.appendChild(span);
    });
    row.appendChild(wrap);
    if (idx < list.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = '   |   ';
      sep.className = 'muted';
      row.appendChild(sep);
    }
  });

  card.appendChild(row);
  document.getElementById('output').appendChild(card);
}

function renderTable(list) {
  const card = document.createElement('div');
  card.className = 'card';
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `<thead><tr><th>Possessions</th><th>Option</th></tr></thead>`;
  const tb = document.createElement('tbody');

  list.forEach(it => {
    const tr = document.createElement('tr');

    const tdA = document.createElement('td');
    tdA.innerHTML = `<span class="badge">${it.plays}</span>`;
    tr.appendChild(tdA);

    const tdB = document.createElement('td');
    const segments = it.txt.split(' + ');
    segments.forEach(seg => {
      const s = document.createElement('span');
      s.className = 'segment';
      s.textContent = seg;
      tdB.appendChild(s);
    });
    tr.appendChild(tdB);

    tb.appendChild(tr);
  });

  table.appendChild(tb);
  card.appendChild(table);
  document.getElementById('output').appendChild(card);
}
