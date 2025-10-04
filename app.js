// ===== Data & helpers =====
const SCORING_PLAYS = [
  { pts: 8, label: "TD + 2pt" },
  { pts: 7, label: "TD + PAT" },
  { pts: 6, label: "TD (no conv)" },
  { pts: 3, label: "FG" },
  { pts: 2, label: "Safety" },
];
const JOINER = ' • '; // separate different plays while keeping "TD + PAT" intact

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toMMSS = (s) => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s/60), ss = s%60;
  return `${String(m).padStart(1,'0')}:${String(ss).padStart(2,'0')}`;
};
const fromMMSS = (txt) => {
  const [m, s] = (txt||'0:00').split(':').map(n=>parseInt(n||'0',10));
  return (m||0)*60 + (s||0);
};

// ===== Scoring core =====
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
  return parts.join(JOINER);
}

// ===== UI refs (scores/options) =====
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

// ===== Banner =====
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

// ===== Renderers =====
function renderRow(list) {
  const card = document.createElement('div'); card.className = 'card';
  const row = document.createElement('div');
  list.forEach((it, idx) => {
    const wrap = document.createElement('span'); wrap.className = 'wrap';
    it.txt.split(JOINER).forEach(seg => {
      const span = document.createElement('span'); span.className = 'segment';
      span.textContent = seg; wrap.appendChild(span);
    });
    row.appendChild(wrap);
    if (idx < list.length - 1) {
      const sep = document.createElement('span'); sep.textContent = '   |   '; sep.className = 'muted';
      row.appendChild(sep);
    }
  });
  card.appendChild(row); elOut.appendChild(card);
}
function renderTable(list) {
  const card = document.createElement('div'); card.className = 'card';
  const table = document.createElement('table'); table.className = 'table';
  table.innerHTML = `<thead><tr><th>Possessions</th><th>Option</th></tr></thead>`;
  const tb = document.createElement('tbody');
  list.forEach(it => {
    const tr = document.createElement('tr');
    const tdA = document.createElement('td'); tdA.innerHTML = `<span class="badge">${it.plays}</span>`;
    const tdB = document.createElement('td');
    it.txt.split(JOINER).forEach(seg => {
      const s = document.createElement('span'); s.className = 'segment'; s.textContent = seg; tdB.appendChild(s);
    });
    tr.appendChild(tdA); tr.appendChild(tdB); tb.appendChild(tr);
  });
  table.appendChild(tb); card.appendChild(table); elOut.appendChild(card);
}
function renderSection(title, resultObj) {
  const header = document.createElement('div'); header.className = 'card'; header.innerHTML = `<strong>${title}</strong>`;
  elOut.appendChild(header);
  if (resultObj.msg) {
    const card = document.createElement('div'); card.className = 'card'; card.innerHTML = `<span class="muted">${resultObj.msg}</span>`;
    elOut.appendChild(card);
  } else {
    (viewTable.checked ? renderTable : renderRow)(resultObj.list);
  }
}

// ===== Scoring compute =====
function validateInt(v) { if (v===""||v==null) return null; const n=Math.floor(Number(v)); return Number.isNaN(n)?null:n; }
function buildItems(target, cap) {
  if (target <= 0) return { msg: target===0 ? "Already tied." : "No points needed." };
  const combos = scoreCombos(target);
  if (!combos.length) return { msg: "Not reachable with standard scoring." };
  const items = combos.map(cs => ({ cs, key: rankKey(cs), txt: formatCombo(cs), plays: cs.reduce((a,b)=>a+b,0) }))
    .sort((a,b) => { for (let i=0;i<a.key.length;i++) if (a.key[i]!==b.key[i]) return a.key[i]-b.key[i]; return a.txt.localeCompare(b.txt); });
  const seen = new Set(), out = [];
  for (const it of items) { if (seen.has(it.txt)) continue; seen.add(it.txt); out.push(it); if (out.length >= cap) break; }
  return { list: out };
}

// ===== Game clock + TOs =====
const elHalf1 = document.getElementById('half1');
const elHalf2 = document.getElementById('half2');
const elTime  = document.getElementById('timeSlider');
const elTimeLbl = document.getElementById('timeLabel');
const elReset = document.getElementById('resetGame');
const elMiniBtns = document.querySelectorAll('.mini');

const elOurToH1 = document.getElementById('ourToH1');
const elOppToH1 = document.getElementById('oppToH1');
const elOurToH2 = document.getElementById('ourToH2');
const elOppToH2 = document.getElementById('oppToH2');

const elBallUs = document.getElementById('ballUs');
const elBallThem = document.getElementById('ballThem');
const elSnaps = document.getElementById('snaps');
const elPlayClock = document.getElementById('playClock');
const elPlayTime  = document.getElementById('playTime');
const elClockResult = document.getElementById('clockResult');

const STATE_KEY = 'scoring-state-v1';
function saveState(){
  const state = {
    our: Number(elOur.value||0), opp: Number(elOpp.value||0),
    half: elHalf2.checked ? 2 : 1,
    time: Number(elTime.value),
    ourToH1: Number(elOurToH1.value), oppToH1: Number(elOppToH1.value),
    ourToH2: Number(elOurToH2.value), oppToH2: Number(elOppToH2.value),
    ball: elBallThem.checked ? 'them' : 'us',
    snaps: Number(elSnaps.value), pclk: Number(elPlayClock.value), ptime: Number(elPlayTime.value)
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(STATE_KEY)||'{}');
    if ('our' in s) elOur.value = s.our;
    if ('opp' in s) elOpp.value = s.opp;
    if (s.half===2) { elHalf2.checked = true; } else { elHalf1.checked = true; }
    if ('time' in s) elTime.value = s.time;
    if ('ourToH1' in s) elOurToH1.value = s.ourToH1;
    if ('oppToH1' in s) elOppToH1.value = s.oppToH1;
    if ('ourToH2' in s) elOurToH2.value = s.ourToH2;
    if ('oppToH2' in s) elOppToH2.value = s.oppToH2;
    if (s.ball==='them') { elBallThem.checked = true; } else { elBallUs.checked = true; }
    if ('snaps' in s) elSnaps.value = s.snaps;
    if ('pclk' in s) elPlayClock.value = s.pclk;
    if ('ptime' in s) elPlayTime.value = s.ptime;
  }catch(e){}
  updateTimeLabel();
}
function updateTimeLabel(){ elTimeLbl.textContent = toMMSS(Number(elTime.value)); }

function adjustTO(inputEl, delta){
  inputEl.value = clamp(Number(inputEl.value)+delta, 0, 3);
  saveState(); updateClockHelper();
}
document.querySelectorAll('.to-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const target = document.getElementById(btn.dataset.target);
    const delta = Number(btn.dataset.delta);
    adjustTO(target, delta);
  });
});
elMiniBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    const dt = Number(b.dataset.dt); // -10 or +10
    elTime.value = clamp(Number(elTime.value) + dt, 0, 1440);
    updateTimeLabel(); saveState(); updateClockHelper();
  });
});

elTime.addEventListener('input', ()=>{ updateTimeLabel(); });
elTime.addEventListener('change', ()=>{ saveState(); updateClockHelper(); });
[elHalf1, elHalf2].forEach(el => el.addEventListener('change', ()=>{ saveState(); updateClockHelper(); }));

[elOurToH1, elOppToH1, elOurToH2, elOppToH2].forEach(el=>{
  el.addEventListener('change', ()=>{ el.value = clamp(Number(el.value),0,3); saveState(); updateClockHelper(); });
});

[elBallUs, elBallThem, elSnaps, elPlayClock, elPlayTime].forEach(el=>{
  el.addEventListener('change', ()=>{ saveState(); updateClockHelper(); });
  el.addEventListener('input',  ()=>{ updateClockHelper(); });
});

elReset.addEventListener('click', ()=>{
  elOur.value = 0; elOpp.value = 0;
  elHalf1.checked = true;
  elTime.value = 1440; updateTimeLabel();
  elOurToH1.value = 3; elOppToH1.value = 3; elOurToH2.value = 3; elOppToH2.value = 3;
  elBallUs.checked = true;
  elSnaps.value = 3; elPlayClock.value = 40; elPlayTime.value = 6;
  saveState();
  run(); updateClockHelper();
});

// ===== Clock helper math =====
// Simple model:
// - If WE have ball and want to bleed:
//   Est burn over N snaps ≈ (N * avgPlayTime) + max(0, N - oppTO) * playClock
//   Capped by time remaining.
// - If THEY have ball and we want to save time:
//   With ourTO timeouts, we can stop the between-play burn up to ourTO times.
//   Est they can drain ≈ (N * avgPlayTime) + max(0, N - ourTO) * playClock
function updateClockHelper(){
  const timeLeft = Number(elTime.value);
  const snaps = clamp(Number(elSnaps.value||3),1,4);
  const pclk  = clamp(Number(elPlayClock.value||40), 20, 45);
  const ptime = clamp(Number(elPlayTime.value||6), 1, 15);
  const half2 = elHalf2.checked;

  const ourTO  = half2 ? Number(elOurToH2.value) : Number(elOurToH1.value);
  const oppTO  = half2 ? Number(elOppToH2.value) : Number(elOppToH1.value);

  if (elBallUs.checked) {
    const burn = snaps*ptime + Math.max(0, snaps - oppTO)*pclk;
    const canBurn = Math.min(timeLeft, burn);
    const remain = Math.max(0, timeLeft - canBurn);
    elClockResult.innerHTML =
      `We have ball. Opp TOs: <b>${oppTO}</b>. With <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSS(canBurn)}</b> (capped by time left). ` +
      (remain===0 ? `<b>You can run out the half.</b>` : `About <b>${toMMSS(remain)}</b> would still remain.`);
  } else {
    const drain = snaps*ptime + Math.max(0, snaps - ourTO)*pclk;
    const canDrain = Math.min(timeLeft, drain);
    const saved = Math.min(timeLeft, snaps*pclk) - Math.min(timeLeft, canDrain - snaps*ptime);
    elClockResult.innerHTML =
      `They have ball. Our TOs: <b>${ourTO}</b>. Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSS(canDrain)}</b>. ` +
      `Using our TOs reduces between-play bleed up to <b>${ourTO}</b> times.`;
  }
}

// ===== Main scoring run =====
elCalc.addEventListener('click', run);
[elOur, elOpp].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') run(); }));

function run() {
  elOut.innerHTML = '';
  elStatus.textContent = '';

  const our = validateInt(elOur.value.trim());
  const opp = validateInt(elOpp.value.trim());
  if (our == null || opp == null) { elStatus.textContent = "Enter both scores."; return; }

  // Banner
  renderBanner(our, opp);

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
  const tieTarget  = diff;
  const leadTarget = diff + 1;

  const usBehind  = Math.max(0, opp - our);
  const oppBehind = Math.max(0, our - opp);

  const teamLabel = teamNeeding === 'us' ? 'We need' :
                    teamNeeding === 'opp' ? 'Opponent needs' : 'Either team needs';

  const tieRes  = buildItems(tieTarget,  cap);
  const leadRes = buildItems(leadTarget, cap);

  const titlePrefix = `${teamLabel} to…`;
  renderSection(`${titlePrefix} Tie`, tieRes);
  renderSection(`${titlePrefix} Take the Lead`, leadRes);

  elStatus.textContent =
    `Score: Us ${our} — Them ${opp} • Us behind: ${usBehind} • Opp behind: ${oppBehind}. Showing exact-point combos.`;

  saveState();
}

// ===== Init =====
loadState();
updateClockHelper();