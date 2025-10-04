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
  if (target > 0) dfs(target, 0);
  return combos;
}

function renderBanner(our, opp){
  const el = document.getElementById('banner');
  const usBehind  = Math.max(0, opp - our);
  const oppBehind = Math.max(0, our - opp);

  let cls = 'neutral';
  let title = 'Game is tied';
  if (our < opp) { cls = 'bad';  title = `We trail by ${usBehind}`; }
  if (our > opp) { cls = 'good'; title = `Opponent trails by ${oppBehind}`; }

  el.className = `banner ${cls}`;
  el.innerHTML = `
    <div class="title">${title}</div>
    <div class="sub">Us ${our} — Them ${opp} • Us behind: ${usBehind} • Opp behind: ${oppBehind}</div>
  `;
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

// ----- UI elems -----
const elOur  = document.querySelector('#ourScore');
const elOpp  = document.querySelector('#oppScore');
const elCap  = document.querySelector('#cap');
const elCalc = document.querySelector('#calc');
const elOut  = document.querySelector('#output');
const elStatus = document.querySelector('#status');
const viewTable = document.querySelector('#view-table');
const viewRow   = document.querySelector('#view-row');
const whoAuto = document.querySelector('#who-auto');
const whoUs   = document.querySelector('#who-us');
const whoOpp  = document.querySelector('#who-opp');

elCalc.addEventListener('click', run);
[elOur, elOpp].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') run(); }));

function validateInt(v) {
  if (v === "" || v == null) return null;
  const n = Math.floor(Number(v));
  return Number.isNaN(n) ? null : n;
}

function buildItems(target, cap) {
  if (target <= 0) {
    return { msg: target === 0 ? "Already tied." : "No points needed." };
  }
  const combos = scoreCombos(target);
  if (!combos.length) return { msg: "Not reachable with standard scoring." };

  const items = combos
    .map(cs => ({ cs, key: rankKey(cs), txt: formatCombo(cs), plays: cs.reduce((a,b)=>a+b,0) }))
    .sort((a,b) => {
      for (let i=0;i<a.key.length;i++) if (a.key[i] !== b.key[i]) return a.key[i]-b.key[i];
      return a.txt.localeCompare(b.txt);
    });

  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (seen.has(it.txt)) continue;
    seen.add(it.txt);
    out.push(it);
    if (out.length >= cap) break;
  }
  return { list: out };
}

function renderList(list) {
  if (viewTable.checked) {
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
    elOut.appendChild(card);
  } else {
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
    elOut.appendChild(card);
  }
}

function renderSection(title, resultObj) {
  const header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = `<strong>${title}</strong>`;
  elOut.appendChild(header);

  if (resultObj.msg) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<span class="muted">${resultObj.msg}</span>`;
    elOut.appendChild(card);
  } else {
    renderList(resultObj.list);
  }
}

function run() {
  elOut.innerHTML = '';
  elStatus.textContent = '';

  const our = validateInt(elOur.value.trim());
  const opp = validateInt(elOpp.value.trim());
  if (our == null || opp == null) { elStatus.textContent = "Enter both scores."; return; }

  const cap = Math.max(1, Number(elCap.value || 200));

  // Who needs points?
  let who = 'auto';
  if (whoUs.checked)  who = 'us';
  if (whoOpp.checked) who = 'opp';

  let teamNeeding = who;
  if (who === 'auto') {
    teamNeeding = (our > opp) ? 'opp' : (our < opp) ? 'us' : 'either';
  }

  const diff = Math.abs(our - opp);
  const tieTarget  = diff;       // exact points to tie
  const leadTarget = diff + 1;   // exact points to take the lead

  // NEW: behind amounts for both sides
  const usBehind  = Math.max(0, opp - our);
  const oppBehind = Math.max(0, our - opp);

  const teamLabel = teamNeeding === 'us' ? 'We need' :
                    teamNeeding === 'opp' ? 'Opponent needs' : 'Either team needs';

  // Build sections
  const tieRes  = buildItems(tieTarget,  cap);
  const leadRes = buildItems(leadTarget, cap);

  const titlePrefix = `${teamLabel} to…`;
  renderSection(`${titlePrefix} Tie`, tieRes);
  renderSection(`${titlePrefix} Take the Lead`, leadRes);

  // UPDATED status line shows behind info
  elStatus.textContent =
    `Score: Us ${our} — Them ${opp} • Us behind: ${usBehind} • Opp behind: ${oppBehind}. Showing exact-point combos.`;
}