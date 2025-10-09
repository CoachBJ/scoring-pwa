// =======================
// Charlotte Christian Game Manager (Streamlined)
// =======================

// ===== Formation & Play dictionaries =====
const FORMATION_LIST = [
  "Bird Rt. Travel","Bird. Lt. Travel","Trips Rt. Travel","Trips Lt. Travel",
  "Bird Rt. 2 On","Bird Lt. 2 On","Dunkin","Taco","Wendy","Biggie","Chop",
  "Trips Rt. Up Travel","Trips Lt. Up Travel","Doubles Rt. DBL Up","Doubles Lt. DBL Up",
  "Trips Lt. Up","Trips Rt. Up","Split Rt. Up","Split Lt. Up","Wing Rt. Split","Wing Lt. Split",
  "King Rt. 4a","King Rt. 4x","King Rt. 4z","King Lt. 4a","King Lt. 4z",
  "Trips Rt. 4a","Trips Rt. 4b","Trips Rt. 4c","Trips Rt. 4x","Trips Rt. 4y","Trips Rt. 4z",
  "Trips Lt. 4a","Trips Lt. 4b","Trips Lt. 4c","Trips Lt. 4x","Trips Lt. 4y","Trips Lt. 4z",
  "Doubles Rt. 4a","Doubles Rt. 4b","Doubles Rt. 4c","Doubles Rt. 4x","Doubles Rt. 4y","Doubles Rt. 4z",
  "Mill","Doubles Rt. On","Doubles Lt. On","Split Rt. Up","Split Lt. Up","Split",
  "Doubles Rt. up","Doubles Lt. Up","Doubles Rt. On","Doubles Lt. On",
  "Trips Rt. up","Trips Lt. Up","Trips Rt. On","Trips Lt. On",
  "Doubles RT. DBL On","Doubles Lt. DBL On","DBL RT DBL On","DBL LT DBL On",
  "Dbls Lt. DBL On","Dbls Rt. DBL On","Dbls Rt. DBL Up","Dbls Lt. Dbl Up","Dbls Rt Dbl Up","Dbls Lt Dbl ON",
  "Doubles","Wing","King","Bird","Trips","Doubles","Doubles","Wing","King","Bird",
  "Frostie","Campbell","PATRIOT","PATRIOT PUMP","Queen","HAWK","Knight","Potter","Brush","Bunch",
  "Swamp","Feather","Knockout",
  "Wing Rt. Double Travel","Wing Rt. DBL Travel","Wing Lt. Double Travel","Wing Lt. DBL Travel"
];

const PLAY_LIST = [
  "CAROLINA","PANTHERS","CHARLOTTE","HORNET","FLORIDA","GATORS","MIAMI","DOLPHIN",
  "MUHAMMAD","ALI","CONNOR","MCGREGOR","PEYTON","MANNING","SPEED","FAST","carolina",
  "TOP","TOM","TRUMP","NONE","Thunder","Lightning","Back","Flat","Buttcrack",
  "Snag","Stick","Tree","Sauce","Slam","Gamer","Hitches","Go","Wide Go","Chains",
  "Curl","Flood","Smash","Holy","Cross","Heel","Michigan","Wolverine","Colt","Colt Corner",
  "Cougar","Carolina","Sword","Ball","Grip","Tinder","Flash","Twitter","Netflix","Tinder Go",
  "Pump Flash","Bluff","Cable","Poker"
];

// --- Normalizers (strip punctuation, case, unify abbreviations) ---
const _norm = s => String(s||'')
  .toLowerCase()
  .replace(/\./g,'')                     // remove periods
  .replace(/\s+rt\b/g,' right')          // "rt" -> "right"
  .replace(/\s+lt\b/g,' left')           // "lt" -> "left"
  .replace(/\b dbl\b/gi,' double')       // "dbl" -> "double"
  .replace(/\b on\b/gi,' on')            // keep "on"
  .replace(/[^a-z0-9 ]+/g,' ')           // strip misc
  .replace(/\s+/g,' ')
  .trim();

// Precompute normalized keys
const _FORM_KEYS = FORMATION_LIST.map(f => ({ raw:f, norm:_norm(f) }));
const _PLAY_KEYS  = PLAY_LIST.map(p => ({ raw:p, norm:_norm(p) }));

const words = (s) => {
  const normalized = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];
  // Use a Set to get only unique words
  return [...new Set(normalized.split(' '))];
};

let __analyticsTimer = null;

const FORM_KEYS_BY_LEN = [..._FORM_KEYS].sort((a,b)=>b.norm.length - a.norm.length);
function detectFormation(call){
  const nc = _norm(call);
  for (const f of FORM_KEYS_BY_LEN){
    if (nc.includes(f.norm)) return f.raw;
  }
  return null;
}

const PLAY_KEYS_BY_LEN = [..._PLAY_KEYS].sort((a,b)=> b.norm.length - a.norm.length);
function detectPlays(call){
  const nc = _norm(call);
  const seen = new Set();
  const hits = [];
  for (const p of PLAY_KEYS_BY_LEN){
    if (nc.includes(p.norm) && !seen.has(p.norm)){
      seen.add(p.norm);
      hits.push(p.raw);
    }
  }
  return hits;
}

const TEAM_NAME = "Charlotte Christian";
const MAX_RESULTS = 200;
const MAX_TIME_SECS = 12 * 60; // 12 minute maximum for the clock
const EXPLOSIVE_PLAY_THRESHOLD = 12; // Yards for an explosive play

const elOurTOLeft = document.getElementById("ourTOLeft");
const elOppTOLeft = document.getElementById("oppTOLeft");
const elOppTOName = document.getElementById("oppTOName");

// ----- Scoring definitions -----
const SCORING_PLAYS = [
  { pts: 8, label: "TD + 2pt" },
  { pts: 7, label: "TD + PAT" },
  { pts: 6, label: "TD (no conv)" },
  { pts: 3, label: "FG" },
  { pts: 2, label: "Safety" },
];
const JOINER = " • ";

function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function setClockResultTheme(weHaveBall){
  const elClockResult = document.getElementById("clockResult");
  const bg = weHaveBall ? cssVar('--primary-color') : cssVar('--opp');
  const fg = weHaveBall ? getContrastColor(bg) : cssVar('--opp-text') || getContrastColor(bg);
  if (elClockResult){
    elClockResult.style.background = bg || '#005a9c';
    elClockResult.style.color = fg || '#fff';
  }
}

function safeIsHalf2() {
  const elHalf2 = document.getElementById("half2");
  return !!(typeof elHalf2 !== 'undefined' && elHalf2 && elHalf2.checked);
}
function safeGetGroupEl(key) {
  return document.querySelector(`.to-card[data-key="${key}"] .to-checks`) || null;
}
function getTOState(key) {
  const g = safeGetGroupEl(key);
  if (!g) return [true, true, true];
  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  return boxes.length ? boxes.map(b => !!b.checked) : [true, true, true];
}
function countTO(key) {
  const arr = getTOState(key);
  return Array.isArray(arr) ? arr.filter(Boolean).length : 3;
}

function renderTimeoutsSummary() {
  if (!elOurTOLeft || !elOppTOLeft) return;
  const half2 = safeIsHalf2();
  elOurTOLeft.textContent = String(half2 ? countTO("our-h2") : countTO("our-h1"));
  elOppTOLeft.textContent = String(half2 ? countTO("opp-h2") : countTO("opp-h1"));
  if (elOppTOName) elOppTOName.textContent = STATE.oppName || "Opponent";
}

function updateClockHelper() {
  try {
    const elSnaps = document.getElementById("snaps");
    const elPlayClock = document.getElementById("playClock");
    const elPlayTime = document.getElementById("playTime");
    const elBallUs = document.getElementById("ballUs");
    const elClockResult = document.getElementById("clockResult");

    const timeLeft = getTimeSecs();
    const snaps    = clamp(Number(elSnaps?.value ?? 3), 1, 4);
    const pclk     = clamp(Number(elPlayClock?.value ?? 40), 20, 45);
    const ptime    = clamp(Number(elPlayTime?.value ?? 6), 1, 15);
    const half2    = safeIsHalf2();

    const ourTO    = half2 ? countTO("our-h2") : countTO("our-h1");
    const oppTO    = half2 ? countTO("opp-h2") : countTO("opp-h1");

    if (elBallUs?.checked) {
      const burn    = snaps * ptime + Math.max(0, snaps - oppTO) * pclk;
      const canBurn = Math.min(timeLeft, burn);
      const remain  = Math.max(0, timeLeft - canBurn);
      elClockResult.innerHTML = `Est burn ≈ <b>${toMMSS(canBurn)}</b>. ~<b>${toMMSS(remain)}</b> would remain.`;
      setClockResultTheme(true);
    } else {
      const drain    = snaps * ptime + Math.max(0, snaps - ourTO) * pclk;
      const canDrain = Math.min(timeLeft, drain);
      const remain   = Math.max(0, timeLeft - canDrain);
      elClockResult.innerHTML = `Est burn ≈ <b>${toMMSS(canDrain)}</b>. ~<b>${toMMSS(remain)}</b> would remain.`;
      setClockResultTheme(false);
    }
  } catch (e) {
    console.error('updateClockHelper:', e);
    const elClockResult = document.getElementById("clockResult");
    if (elClockResult) {
      elClockResult.textContent = 'Clock helper paused due to an input error. Fix inputs or toggle half to refresh.';
    }
  } finally {
    renderTimeoutsSummary();
    if (window.__recalcTwoPointDecision) window.__recalcTwoPointDecision();
  }
}

function useTO(side) {
  const half2 = safeIsHalf2();
  const key = `${side}-${half2 ? 'h2' : 'h1'}`;
  const g = safeGetGroupEl(key);
  if (!g) { renderTimeoutsSummary(); updateClockHelper(); return; }

  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  if (!boxes.length) { renderTimeoutsSummary(); updateClockHelper(); return; }

  const idx = [...boxes].map(b => b.checked).lastIndexOf(true);
  if (idx >= 0) {
    boxes[idx].checked = false;
    saveState();
  }
  renderTimeoutsSummary();
  updateClockHelper();
}

function updateTOHeadings() {
  const opp = STATE.oppName || "Opponent";
  const ourH1 = document.querySelector('.to-card[data-key="our-h1"] .to-title span');
  const ourH2 = document.querySelector('.to-card[data-key="our-h2"] .to-title span');
  const oppH1 = document.querySelector('.to-card[data-key="opp-h1"] .to-title span');
  const oppH2 = document.querySelector('.to-card[data-key="opp-h2"] .to-title span');

  if (ourH1) ourH1.textContent = "Charlotte Christian TOs — 1st";
  if (ourH2) ourH2.textContent = "Charlotte Christian TOs — 2nd";
  if (oppH1) oppH1.textContent = `${opp} TOs — 1st`;
  if (oppH2) oppH2.textContent = `${opp} TOs — 2nd`;
}

// ----- Utils -----
function applyOpponentProfile(){
  const elOppName = document.getElementById("oppName");
  const elOppColor = document.getElementById("oppColor");
  const elOppLabel = document.getElementById("oppLabel");
  const elOurLabel = document.getElementById("ourLabel");
  const elOppTOName = document.getElementById("oppTOName");
  const elOppNameTO = document.getElementById("oppNameTO");
  const elOppNameInline = document.getElementById("oppNameInline");


  if (elOppName)  elOppName.value  = STATE.oppName;
  if (elOppColor) elOppColor.value = STATE.oppColor;

  const oppTextColor = getContrastColor(STATE.oppColor || '#9a9a9a');
  const root = document.documentElement;
  root.style.setProperty('--opp', STATE.oppColor || '#9a9a9a');
  root.style.setProperty('--opp-text', oppTextColor);

  if (elOppLabel) elOppLabel.textContent = STATE.oppName || 'Opponent';
  if (elOurLabel) elOurLabel.textContent = TEAM_NAME;

  const elBallThemName = document.getElementById('ballThemName');
  if (elBallThemName) elBallThemName.textContent = STATE.oppName || 'Opponent';
  if (elOppTOName) elOppTOName.textContent = STATE.oppName || 'Opponent';
  if (elOppNameTO) elOppNameTO.textContent = STATE.oppName || 'Opponent';
  if (elOppNameInline) elOppNameInline.textContent = STATE.oppName || 'Opponent';

  updateTOHeadings();
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toMMSS = (s) => { s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), ss=s%60; return `${m}:${String(ss).padStart(2,"0")}`; };

function getContrastColor(hex) {
    if (!hex) return '#ffffff';
    if (hex.length === 4) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

// ===== Turnovers (per-type, both teams on one line) =====
const TO_IDS = {
  our: {
    fumLost:   { plus: 'ourFLplus',  minus: 'ourFLminus',  val: 'ourFL'  },
    fumRec:    { plus: 'ourFRplus',  minus: 'ourFRminus',  val: 'ourFR'  },
    intThrown: { plus: 'ourINTplus', minus: 'ourINTminus', val: 'ourINT' }
  },
  opp: {
    fumLost:   { plus: 'oppFLplus',  minus: 'oppFLminus',  val: 'oppFL'  },
    fumRec:    { plus: 'oppFRplus',  minus: 'oppFRminus',  val: 'oppFR'  },
    intThrown: { plus: 'oppINTplus', minus: 'oppINTminus', val: 'oppINT' }
  }
};

function clampNonNeg(n){ n = Math.floor(Number(n)||0); return Math.max(0, Math.min(99, n)); }

function computeTOMargin(){
  const t = STATE.turnovers;
  const ourTake  = clampNonNeg(t.our.fumRec) + clampNonNeg(t.opp.intThrown);
  const ourGive  = clampNonNeg(t.our.fumLost) + clampNonNeg(t.our.intThrown);
  return ourTake - ourGive;
}

function renderTurnovers(){
  for (const side of ['our','opp']){
    for (const key of ['fumLost','fumRec','intThrown']){
      const id = TO_IDS[side][key].val;
      const el = document.getElementById(id);
      if (el) el.textContent = clampNonNeg(STATE.turnovers[side][key]);
    }
  }
  const diff = computeTOMargin();
  const elDiff = document.getElementById('toDiff');
  if (elDiff){
    elDiff.textContent = `TO Margin: ${diff>0?'+':''}${diff}`;
    elDiff.classList.remove('pos','neg');
    if (diff>0) elDiff.classList.add('pos');
    if (diff<0) elDiff.classList.add('neg');
  }
}

(function wireTurnoversPerType(){
  const mirror = (side) => side === 'our' ? 'opp' : 'our';
  const bump = (side, key, delta) => {
    if (!delta) return;
    const cur = clampNonNeg(STATE.turnovers[side][key]);
    STATE.turnovers[side][key] = clampNonNeg(cur + delta);
    const other = mirror(side);
    if (key === 'fumLost') {
      const curRec = clampNonNeg(STATE.turnovers[other].fumRec);
      STATE.turnovers[other].fumRec = clampNonNeg(curRec + delta);
    } else if (key === 'fumRec') {
      const curLost = clampNonNeg(STATE.turnovers[other].fumLost);
      STATE.turnovers[other].fumLost = clampNonNeg(curLost + delta);
    }
    renderTurnovers();
    saveState();
    if (navigator.vibrate) navigator.vibrate(10);
  };
  const bind = (side, key) => {
    const ids = TO_IDS[side][key];
    document.getElementById(ids.plus)?.addEventListener('click',  () => bump(side, key, +1));
    document.getElementById(ids.minus)?.addEventListener('click', () => bump(side, key, -1));
  };
  ['our','opp'].forEach(side => {
    ['fumLost','fumRec','intThrown'].forEach(key => bind(side, key));
  });
})();

const fromMMSS = (txt) => {
  const str = String(txt || "").trim();
  if (!str) return null;
  const classicMatch = str.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (classicMatch) {
    const m = parseInt(classicMatch[1], 10);
    const s = parseInt(classicMatch[2], 10);
    return clamp(m * 60 + s, 0, MAX_TIME_SECS);
  }
  const numericOnly = str.replace(/\D/g, '');
  if (numericOnly.length > 0 && numericOnly.length <= 4) {
    let m = 0, s = 0;
    if (numericOnly.length <= 2) {
      s = parseInt(numericOnly, 10);
    } else if (numericOnly.length === 3) {
      m = parseInt(numericOnly.substring(0, 1), 10);
      s = parseInt(numericOnly.substring(1), 10);
    } else {
      m = parseInt(numericOnly.substring(0, 2), 10);
      s = parseInt(numericOnly.substring(2), 10);
    }
    if (s >= 60 || m > 12) return null;
    return clamp(m * 60 + s, 0, MAX_TIME_SECS);
  }
  return null;
};

// ----- Scoring core -----
function updateSecondHalfInfo(){
    const elSecondHalfInfo = document.getElementById("secondHalfInfo");
  if (!elSecondHalfInfo) return;
  let txt = "2nd-half kickoff: —";
  if (STATE.openingKO === "we")  txt = "2nd-half kickoff: Opponent";
  if (STATE.openingKO === "opp") txt = "2nd-half kickoff: Charlotte Christian";
  elSecondHalfInfo.textContent = txt;
}

function scoreCombos(target){
  const combos=[], counts=new Array(SCORING_PLAYS.length).fill(0);
  function dfs(rem,start){ if(rem===0){combos.push([...counts]);return;}
    for(let i=start;i<SCORING_PLAYS.length;i++){ const p=SCORING_PLAYS[i].pts; if(p>rem) continue; counts[i]++; dfs(rem-p,i); counts[i]--; } }
  if(target>0) dfs(target,0); return combos;
}
function rankKey(counts){ const total=counts.reduce((a,b)=>a+b,0); return [total,-counts[0],-counts[1],-counts[2],counts[3],counts[4]]; }
function formatCombo(counts){ const parts=[]; for(let i=0;i<counts.length;i++){const c=counts[i]; if(!c) continue; parts.push(c>1?`${c}x ${SCORING_PLAYS[i].label}`:SCORING_PLAYS[i].label);} return parts.join(JOINER); }
function validateInt(v){ if(v===""||v==null) return null; const n=Math.floor(Number(v)); return Number.isNaN(n)?null:n; }
function buildItems(target, cap){
  if(target<=0) return { msg: target===0 ? "Already tied." : "No points needed." };
  const combos = scoreCombos(target); if(!combos.length) return { msg:"Not reachable with standard scoring." };
  const items = combos.map(cs=>({ cs, key: rankKey(cs), txt: formatCombo(cs), plays: cs.reduce((a,b)=>a+b,0) }))
    .sort((a,b)=>{ for(let i=0;i<a.key.length;i++){ if(a.key[i]!==b.key[i]) return a.key[i]-b.key[i]; } return a.txt.localeCompare(b.txt); });
  const seen=new Set(), out=[]; for(const it of items){ if(seen.has(it.txt)) continue; seen.add(it.txt); out.push(it); if(out.length>=cap) break; }
  return { list: out };
}

// ----- DOM refs -----
const elOur = document.querySelector("#ourScore");
const elOpp = document.querySelector("#oppScore");
const elScenarios = document.querySelector("#scoring-scenarios");
const elStatus=document.querySelector("#status");
const viewTable=document.querySelector("#view-table");
const viewRow  =document.querySelector("#view-row");

function renderBanner(our, opp, oppName){
  const el = document.getElementById("banner");
  if (!el) return;
  const usBehind  = Math.max(0, opp - our);
  const oppBehind = Math.max(0, our - opp);
  let cls="neutral", title="Game is tied";
  if(our < opp){ cls="bad";  title = `${TEAM_NAME} trails by ${usBehind}`; }
  if(our > opp){ cls="good"; title = `${oppName} trails by ${oppBehind}`; }
  el.className = `banner ${cls}`;
  el.innerHTML = `
    <div class="title">${title}</div>
    <div class="sub">${TEAM_NAME} ${our} — ${oppName} ${opp}</div>
  `;
}

function renderRow(list){
  const card=document.createElement("div"); card.className="card";
  const row=document.createElement("div"); row.className = "score-options-cell";
  list.forEach((it,idx)=>{
    it.txt.split(JOINER).forEach(seg=>{ const span=document.createElement("span"); span.className="segment"; span.textContent=seg; row.appendChild(span); });
    if(idx<list.length-1){ const sep=document.createElement("span"); sep.textContent="|"; sep.className="muted"; row.appendChild(sep); }
  });
  card.appendChild(row); elScenarios.appendChild(card);
}
function renderTable(list){
  const card=document.createElement("div"); card.className="card";
  const table=document.createElement("table"); table.className="table";
  table.innerHTML = `<thead><tr><th>Possessions</th><th>Option</th></tr></thead>`;
  const tb=document.createElement("tbody");
  list.forEach(it=>{
    const tr=document.createElement("tr");
    const tdA=document.createElement("td"); tdA.innerHTML=`<span class="badge">${it.plays}</span>`;
    const tdB=document.createElement("td"); tdB.className = 'score-options-cell';
    it.txt.split(JOINER).forEach(seg=>{ const s=document.createElement("span"); s.className="segment"; s.textContent=seg; tdB.appendChild(s); });
    tr.appendChild(tdA); tr.appendChild(tdB); tb.appendChild(tr);
  });
  table.appendChild(tb); card.appendChild(table); elScenarios.appendChild(card);
}
function renderSection(title, resultObj){
  const header=document.createElement("h2"); header.className="section-title"; header.style.marginTop = '20px'; header.textContent = title; elScenarios.appendChild(header);
  if(resultObj.msg){ const card=document.createElement("div"); card.className="card"; card.innerHTML=`<span class="muted">${resultObj.msg}</span>`; elScenarios.appendChild(card); }
  else { (viewTable.checked?renderTable:renderRow)(resultObj.list); }
}

function renderOfficials(){
  const elHeadRefDisplay = document.getElementById("headRefDisplay");
  const elSideJudgeDisplay = document.getElementById("sideJudgeDisplay");
  const elOfficialsDisplay = document.getElementById("officialsDisplay");
  const hr = STATE.officials.headRef?.trim();
  const sj = STATE.officials.sideJudge?.trim();
  if (elHeadRefDisplay)   elHeadRefDisplay.textContent   = hr ? `Head Ref: ${hr}` : "";
  if (elSideJudgeDisplay) elSideJudgeDisplay.textContent = sj ? `Side Judge (our sideline): ${sj}` : "";
  const any = !!(hr || sj);
  if (elOfficialsDisplay) elOfficialsDisplay.style.display = any ? "grid" : "none";
}

// ===== Game clock / TOs =====
const elTimeInput=document.getElementById("timeInput");

function setTOState(key, arr){
  const g = safeGetGroupEl(key);
  if (!g) return;
  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  boxes.forEach((b,i)=>{ b.checked = (arr && typeof arr[i]==="boolean") ? arr[i] : true; });
}

function getTimeSecs(){ const s=fromMMSS(elTimeInput.value); return s==null?0:s; }
function setTimeSecs(secs){ elTimeInput.value = toMMSS(clamp(secs,0,MAX_TIME_SECS)); }

function commitManualTime(){
  const secs=fromMMSS(elTimeInput.value);
  if(secs==null){ elTimeInput.classList.add("error"); return; }
  elTimeInput.classList.remove("error");
  setTimeSecs(secs); saveState(); updateClockHelper();
}

function wireEventListeners() {
    const elWeKO = document.getElementById("weReceivedKO");
    const elOppKO = document.getElementById("oppReceivedKO");
    const elHeadRef = document.getElementById("headRef");
    const elSideJudge = document.getElementById("sideJudge");
    const elClearOfficials = document.getElementById("clearOfficials");
    const elOppName = document.getElementById("oppName");
    const elOppColor = document.getElementById("oppColor");
    const elBallUs = document.getElementById("ballUs");
    const elBallThem = document.getElementById("ballThem");
    const elSnaps = document.getElementById("snaps");
    const elPlayClock = document.getElementById("playClock");
    const elPlayTime = document.getElementById("playTime");
    const elHalf1 = document.getElementById("half1");
    const elHalf2 = document.getElementById("half2");
    
    document.querySelectorAll('.mini[data-dt]').forEach(b=>{
        b.addEventListener("click", ()=>{
            let secs = getTimeSecs();
            secs = clamp(secs + Number(b.dataset.dt), 0, MAX_TIME_SECS);
            setTimeSecs(secs); saveState(); updateClockHelper();
        });
    });

    elTimeInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ commitManualTime(); }});
    elTimeInput.addEventListener("blur", commitManualTime);
    elTimeInput.addEventListener("focus", ()=>{ elTimeInput.select(); });

    if (elClearOfficials) {
        elClearOfficials.addEventListener("click", () => {
            elHeadRef.value = "";
            elSideJudge.value = "";
            STATE.officials.headRef = "";
            STATE.officials.sideJudge = "";
            renderOfficials();
            saveState();
        });
    }

    document.querySelectorAll('.chip').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            const team = btn.dataset.team; const delta = Number(btn.dataset.delta||0);
            const our = Number(elOur.value||0), opp = Number(elOpp.value||0);
            if(team==='our'){ elOur.value = our + delta; }
            else { elOpp.value = opp + delta; }
            saveState(); run();
        });
    });
    
    [elBallUs, elBallThem, elSnaps, elPlayClock, elPlayTime, elHalf1, elHalf2]
      .filter(Boolean)
      .forEach(el => {
        el.addEventListener("change", () => { saveState(); updateClockHelper(); });
        el.addEventListener("input",  () => { updateClockHelper(); });
      });
      
    [elWeKO, elOppKO].filter(Boolean).forEach(r => {
        r.addEventListener("change", () => {
            STATE.openingKO = elWeKO?.checked ? "we" : (elOppKO?.checked ? "opp" : null);
            updateSecondHalfInfo();
            saveState();
        });
    });

    [elHeadRef, elSideJudge].filter(Boolean).forEach(inp => {
        inp.addEventListener('input', () => {
            STATE.officials.headRef   = elHeadRef?.value.trim()   || "";
            STATE.officials.sideJudge = elSideJudge?.value.trim() || "";
            renderOfficials();
            saveState();
        });
    });
    
    elOppName.addEventListener('input', () => {
        STATE.oppName = elOppName.value || 'Opponent';
        applyOpponentProfile();
        updateClockHelper();
        saveState();
        run();
    });

    elOppColor.addEventListener('input', () => {
        STATE.oppColor = elOppColor.value;
        applyOpponentProfile();
        updateClockHelper();
        saveState();
    });
    
    [elOur,elOpp].forEach(el=>el.addEventListener("input", run));
    [viewTable, viewRow].forEach(el => el.addEventListener('change', run));

    [elOur, elOpp].forEach(el => {
        el.addEventListener('change', () => {
            const score = parseInt(el.value, 10);
            if (isNaN(score) || score < 0) {
                el.value = 0;
                run();
            }
        });
    });
    
    document.getElementById("resetGame").addEventListener("click", ()=>{
      if (confirm('Are you sure you want to reset the entire game?')) {
        localStorage.removeItem(STATE_KEY);
        window.location.reload();
      }
    });
    
    document.querySelectorAll('.to-title').forEach(title => {
      title.addEventListener('click', () => {
        const card = title.closest('.to-card[data-key]');
        if (card) {
            card.classList.toggle('collapsed');
            saveState();
        }
      });
    });
    
    document.querySelectorAll('.to-checks input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            saveState();
            updateClockHelper();
        });
    });
    
    (function wireUseTOButtons() {
      const hook = (id, side) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const fire = () => { useTO(side); if (navigator.vibrate) navigator.vibrate(20); };
        btn.addEventListener('click', fire);
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
        let t = null;
        btn.addEventListener('pointerdown', () => {
          btn.classList.add('btn-pressing');
          t = setTimeout(fire, 350);
        });
        ['pointerup','pointerleave','pointercancel'].forEach(ev => {
          btn.addEventListener(ev, () => {
            btn.classList.remove('btn-pressing');
            if (t) { clearTimeout(t); t = null; }
          });
        });
        btn.addEventListener('dblclick', fire);
      };
      hook('useOurTO','our');
      hook('useOppTO','opp');
    })();
}

// ----- State -----
const STATE_KEY = "ccs-gamemanager-state-v5"; // Bumping version for new data model
let STATE = {
  oppName: "Opponent",
  oppColor: "#9a9a9a",
  collapsedTO: {},
  openingKO: null,
  officials: { headRef: "", sideJudge: "" },
  turnovers: {
    our: { fumLost: 0, fumRec: 0, intThrown: 0 },
    opp: { fumLost: 0, fumRec: 0, intThrown: 0 }
  },
  touchRoster: [],
  touches: {},
  offPlays: [],
  defPlays: []
};

function saveState(){
  document.querySelectorAll('.to-card[data-key]').forEach(card=>{
    STATE.collapsedTO[card.dataset.key] = card.classList.contains('collapsed');
  });
  
  const elWeKO = document.getElementById("weReceivedKO");
  const elOppKO = document.getElementById("oppOppKO");
  STATE.openingKO = (elWeKO?.checked) ? "we" : ((elOppKO?.checked) ? "opp" : null);

  const s = {
    our: Number(elOur.value||0),
    opp: Number(elOpp.value||0),
    half: safeIsHalf2() ? 2 : 1,
    time: getTimeSecs(),
    to: {
      "our-h1": getTOState("our-h1"), "opp-h1": getTOState("opp-h1"),
      "our-h2": getTOState("our-h2"), "opp-h2": getTOState("opp-h2")
    },
    oppName:   STATE.oppName,
    oppColor:  STATE.oppColor,
    collapsedTO: STATE.collapsedTO,
    openingKO:  STATE.openingKO,
    officials:  STATE.officials,
    turnovers:  STATE.turnovers,
    offPlays:   STATE.offPlays,
    defPlays:   STATE.defPlays,
    touches:    STATE.touches,
    touchRoster: STATE.touchRoster,
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");

    if (elOur) elOur.value = s.our ?? 0;
    if (elOpp) elOpp.value = s.opp ?? 0;

    const elHalf1 = document.getElementById("half1");
    const elHalf2 = document.getElementById("half2");
    const halfEl = (s.half === 2 && elHalf2) ? elHalf2 : elHalf1;
    if (halfEl) halfEl.checked = true;

    setTimeSecs(typeof s.time === "number" ? s.time : MAX_TIME_SECS);

    if (s.to) Object.keys(s.to).forEach(k => setTOState(k, s.to[k]));
    else ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k => setTOState(k,[true,true,true]));

    STATE.collapsedTO = s.collapsedTO || {};
    Object.keys(STATE.collapsedTO).forEach(key => {
      const card = document.querySelector(`.to-card[data-key="${key}"]`);
      if (card && STATE.collapsedTO[key]) card.classList.add('collapsed');
    });

    STATE.oppName  = s.oppName  || "Opponent";
    STATE.oppColor = s.oppColor || "#9a9a9a";
    applyOpponentProfile();

    const elWeKO = document.getElementById("weReceivedKO");
    const elOppKO = document.getElementById("oppReceivedKO");
    STATE.openingKO = s.openingKO || null;
    if (elWeKO)  elWeKO.checked  = STATE.openingKO === "we";
    if (elOppKO) elOppKO.checked = STATE.openingKO === "opp";

    const elHeadRef = document.getElementById("headRef");
    const elSideJudge = document.getElementById("sideJudge");
    STATE.officials = s.officials || { headRef: "", sideJudge: "" };
    if (elHeadRef)   elHeadRef.value   = STATE.officials.headRef   || "";
    if (elSideJudge) elSideJudge.value = STATE.officials.sideJudge || "";
    
    STATE.touches = s.touches || {};
    STATE.touchRoster = s.touchRoster || DEFAULT_ROSTER;

    STATE.offPlays = migrateRows(s.offPlays);
    STATE.defPlays = migrateRows(s.defPlays);

    if (typeof s.turnovers === "number" || typeof (s.turnovers?.our) === "number") {
      const ourNum = typeof s.turnovers === "number" ? s.turnovers : (s.turnovers?.our || 0);
      const oppNum = typeof s.turnovers === "number" ? 0 : (s.turnovers?.opp || 0);
      STATE.turnovers = {
        our: { fumLost: ourNum, fumRec: 0, intThrown: 0 },
        opp: { fumLost: oppNum, fumRec: 0, intThrown: 0 }
      };
    } else {
      STATE.turnovers = s.turnovers || STATE.turnovers;
    }

    renderTurnovers();
    updateSecondHalfInfo();
    renderOfficials();
  } catch(e){
    console.error("Failed to load state", e);
    // Reset to defaults on error
    Object.assign(STATE, {
        oppName: "Opponent", oppColor: "#9a9a9a", collapsedTO: {}, openingKO: null,
        officials: { headRef: "", sideJudge: "" },
        turnovers: { our: { fumLost: 0, fumRec: 0, intThrown: 0 }, opp: { fumLost: 0, fumRec: 0, intThrown: 0 } },
        touchRoster: DEFAULT_ROSTER, touches: {},
        offPlays: [], defPlays: []
    });
    setTimeSecs(MAX_TIME_SECS);
    ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k => setTOState(k,[true,true,true]));
    STATE.offPlays = migrateRows(null);
    STATE.defPlays = migrateRows(null);
    renderTurnovers(); updateSecondHalfInfo(); renderOfficials();
  }
}

function run(){
  if (elScenarios) elScenarios.innerHTML=""; 
  if (elStatus) elStatus.textContent="";
  const our=validateInt(elOur.value);
  const opp=validateInt(elOpp.value);
  if(our==null || opp==null){ if (elStatus) elStatus.textContent="Enter both scores."; return; }

  renderBanner(our, opp, STATE.oppName);

  let teamNeeding = our > opp ? "opp" : our < opp ? "us" : "either";
  if (teamNeeding !== 'either') {
    const diff=Math.abs(our-opp);
    const tieTarget=diff, leadTarget=diff+1;
    const teamLabel = teamNeeding==="us" ? `${TEAM_NAME} needs` : `${STATE.oppName} needs`;
    const tieRes = buildItems(tieTarget, MAX_RESULTS);
    const leadRes= buildItems(leadTarget, MAX_RESULTS);
    renderSection(`${teamLabel} to Tie`, tieRes);
    renderSection(`${teamLabel} to Take the Lead`, leadRes);
  } else {
     if (elScenarios) elScenarios.innerHTML = "";
  }
  if (window.__recalcTwoPointDecision) window.__recalcTwoPointDecision();
  saveState();
  queueAnalytics();
}

// ===== 2-Point Decision (after TD) =====
(function twoPointModule(){
  const elXP  = document.getElementById('xpRate');
  const el2P  = document.getElementById('twoPtRate');
  const elRes = document.getElementById('twoPtResult');
  const elMath= document.getElementById('twoPtMath');
  const btnRe = document.getElementById('recalcTwoPt');
  if (!elXP || !el2P || !elRes) return;

  const CRIT = {
    '-25': "🟢 GO FOR 2 » Goal: down 23 (3-score window)", '-24': "🟢 GO FOR 2 » Move to -22 (improves path)",
    '-23': "🟢 GO FOR 2 » Goal: down 21 (clean 3 TDs)", '-20': "🟢 GO FOR 2 » Goal: down 18 (clean 3 TDs)",
    '-18': "🟢 GO FOR 2 » Down 16 clarifies path (2 TD + 2×2pt)", '-17': "🟢 GO FOR 2 » Reduces needed 2PCs later (to -15)",
    '-16': "🟢 GO FOR 2 » Goal: down 14 (clean 2 TDs)", '-13': "🟢 GO FOR 2 » Create TD+FG game (to -11)",
    '-10': "🟢 GO FOR 2 » Make it one-score (down 8)", '-9':  "🟢 GO FOR 2 » Make it one-score (down 7)",
    '-5':  "🟢 GO FOR 2 » Get to FG game (down 3)", '-2':  "🟢 GO FOR 2 » Tie it",
    '1':   "🟢 GO FOR 2 » Up 3 (FG only ties)", '4':   "🟢 GO FOR 2 » Up 6 > up 5 vs opp TD",
    '5':   "🟢 GO FOR 2 » Up 7 (true one-score)", '12':  "🟢 GO FOR 2 » Up 14 (two-score standard)",
    '14':  "🟢 GO FOR 2 » Up 16 (requires 2 TD + 2×2pt to tie)", '19':  "🟢 GO FOR 2 » Up 21 (three-score standard)",
    '22':  "🟢 GO FOR 2 » Up 24 (3 TD + 3×2pt to tie)"
  };

  function classify(decision){
    if (decision.startsWith('🟢')) return 'result-go';
    if (decision.startsWith('🟡')) return 'result-consider';
    return 'result-kick';
  }

  function calcTwoPointDecision(){
    const our = validateInt(document.getElementById('ourScore')?.value);
    const opp = validateInt(document.getElementById('oppScore')?.value);
    if (our == null || opp == null) {
      elRes.textContent = '—';
      elRes.className='two-pt-result';
      if (elMath) elMath.textContent = '';
      return;
    }
    const xp = Math.max(0, Math.min(100, Number(elXP.value || 0))) / 100;
    const tp = Math.max(0, Math.min(100, Number(el2P.value || 0))) / 100;
    const diffAfterTD = (our - opp) + 6;
    const ep2 = 2 * tp, epp = 1 * xp;
    const timeLeft = getTimeSecs();
    const late = safeIsHalf2() || timeLeft <= 120;

    let final = CRIT[String(diffAfterTD)] || '';
    if (!final) {
        const decisionText = ep2 > epp ? `GO FOR 2 » EP ${ep2.toFixed(2)} vs ${epp.toFixed(2)}` : `KICK PAT » EP ${epp.toFixed(2)} vs ${ep2.toFixed(2)}`;
        if (late) {
            final = `🟡 ${ep2 > epp ? '' : 'Consider '}${decisionText}`;
        } else {
            final = `${ep2 > epp ? '🟢' : '🔴'} ${decisionText}`;
        }
    }
    elRes.textContent = final;
    elRes.className = `two-pt-result ${classify(final)}`;

    if (elMath){
      const line1 = `Math: EP(2-pt) = 2 × ${(tp*100).toFixed(0)}% = <b>${ep2.toFixed(2)}</b> • EP(PAT) = 1 × ${(xp*100).toFixed(0)}% = <b>${epp.toFixed(2)}</b>`;
      let line2 = `After TD: <b>${diffAfterTD > 0 ? `Charlotte Christian will be UP by ${diffAfterTD}` : diffAfterTD < 0 ? `Charlotte Christian will be DOWN by ${Math.abs(diffAfterTD)}` : 'Game would be TIED'}</b>.`;
      elMath.innerHTML = `${line1}<br>${line2}`;
    }
  }

  btnRe?.addEventListener('click', calcTwoPointDecision);
  [elXP, el2P].forEach(inp => inp?.addEventListener('input', calcTwoPointDecision));
  window.__recalcTwoPointDecision = calcTwoPointDecision;
})();

// ===== Offensive Touch Counter =====
const DEFAULT_ROSTER = [
  "RB1", "WR1", "WR2", "WR3", "TE1", "QB1", "RB2", "WR4", "TE2", "Slot",
  "FB", "H-Back", "Wing", "RB3", "WR5", "KR/WR", "PR/WR", "Utility", "Motion", "Jet"
];

function ensureTouchState() {
  if (!STATE.touchRoster || !Array.isArray(STATE.touchRoster) || STATE.touchRoster.length === 0) {
    STATE.touchRoster = DEFAULT_ROSTER.slice();
  }
  if (!STATE.touches || typeof STATE.touches !== 'object') STATE.touches = {};
  for (const name of STATE.touchRoster) {
    if (typeof STATE.touches[name] !== 'number') STATE.touches[name] = 0;
  }
}

function renderTouchCounter() {
  const list = document.getElementById('tcList');
  const totalEl = document.getElementById('tcTotal');
  if (!list || !totalEl) return;
  ensureTouchState();
  list.innerHTML = '';
  let total = 0;
  for (const name of STATE.touchRoster) {
    const val = STATE.touches[name] ?? 0;
    total += val;
    const row = document.createElement('div');
    row.className = 'tc-row';
    row.innerHTML = `
      <div class="tc-name">${name}</div>
      <button class="tc-btn" data-name="${name}" data-d="-1">−</button>
      <div class="tc-val" id="tcVal-${cssSafe(name)}">${val}</div>
      <button class="tc-btn" data-name="${name}" data-d="+1">+</button>
    `;
    list.appendChild(row);
  }
  totalEl.textContent = String(total);
  list.querySelectorAll('.tc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      const d = Number(btn.getAttribute('data-d'));
      bumpTouch(name, d);
    });
  });
  document.getElementById('tcReset')?.addEventListener('click', () => {
    if (!confirm('Reset all touch counts?')) return;
    for (const n of STATE.touchRoster) STATE.touches[n] = 0;
    saveState();
    renderTouchCounter();
  });
}

function cssSafe(s){ return String(s).replace(/[^a-z0-9_-]/gi,'_'); }

function bumpTouch(name, delta) {
  ensureTouchState();
  const cur = Math.max(0, Number(STATE.touches[name] || 0));
  STATE.touches[name] = Math.max(0, cur + delta);
  const valEl = document.getElementById(`tcVal-${cssSafe(name)}`);
  if (valEl) valEl.textContent = String(STATE.touches[name]);
  const total = Object.values(STATE.touches).reduce((a,b)=>a + (Number(b)||0), 0);
  const totalEl = document.getElementById('tcTotal');
  if (totalEl) totalEl.textContent = String(total);
  saveState();
  if (navigator.vibrate) navigator.vibrate(10);
}

// ===== Playlists (Offense / Defense) — NEW LOGIC =====
const PLAY_ROWS = 75;
const EMPTY_ROW = () => ({ yl:"", dn:"", dist:"", call:"", gain:0, isNewDrive: false });

function migrateRows(arr){
  if (!Array.isArray(arr)) return Array(PLAY_ROWS).fill(0).map(EMPTY_ROW);
  return arr.map(v => (v && typeof v === 'object')
    ? { yl:v.yl??"", dn:v.dn??"", dist:v.dist??"", call:v.call??"", gain:v.gain||0, isNewDrive:!!v.isNewDrive }
    : { ...EMPTY_ROW(), call:String(v||"") }
  ).concat(Array(Math.max(0, PLAY_ROWS - arr.length)).fill(0).map(EMPTY_ROW)).slice(0, PLAY_ROWS);
}

// Convert yard line string (e.g., "-25") to absolute distance from own goal (0-100)
function parseYardLineToAbsolute(ylString) {
    const yl = parseInt(ylString, 10);
    if (isNaN(yl) || yl > 50 || yl < -50 || yl === 0) return null;
    if (yl < 0) return Math.abs(yl); // Our side: -20 is 20 yards from our goal.
    if (yl > 0) return 100 - yl;     // Opponent's side: 20 is 80 yards from our goal.
    return 50; // 50 yard line
}

// NEW: Convert absolute distance (0-100) back to yard line string
function absoluteToYardLineString(abs) {
    if (abs <= 0 || abs >= 100) return null; // Out of bounds (touchdown/touchback)
    if (abs === 50) return "50";
    if (abs < 50) return String(-abs); // Our side
    if (abs > 50) return String(100 - abs); // Opponent's side
    return null;
}

function recalcGains(){
  const calc = (rows) => {
    for (let i=0; i < rows.length; i++){
      const curRow = rows[i];
      if (typeof curRow.gain === 'string') continue; // Skip TO/INT

      const nextRow = (i + 1 < rows.length) ? rows[i+1] : null;
      if (!nextRow || nextRow.isNewDrive || !curRow.yl || !nextRow.yl) {
        continue;
      }
      const curAbs = parseYardLineToAbsolute(curRow.yl);
      const nxtAbs = parseYardLineToAbsolute(nextRow.yl);
      if (curAbs !== null && nxtAbs !== null) {
        curRow.gain = nxtAbs - curAbs;
      }
    }
  };
  calc(STATE.offPlays);
  calc(STATE.defPlays);
}

function playHeadRow(){
  const head = document.createElement('div');
  head.className = 'play-head';
  head.innerHTML = `<div>#</div><div>New</div><div>YL</div><div>Dn</div><div>Dist</div><div>Play Call</div><div>Result</div>`;
  return head;
}

function makeRows(arr, prefix){
  const frag = document.createDocumentFragment();
  frag.appendChild(playHeadRow());
  for (let i=0;i<PLAY_ROWS;i++){
    const p = arr[i] || EMPTY_ROW();
    const wrap = document.createElement('div');
    wrap.className = 'play-row';
    // Use 'text' type for gain to allow "INT" or "TO"
    wrap.innerHTML = `
      <div class="idx">${i+1}</div>
      <input id="${prefix}nd_${i}" class="play-new-drive" type="checkbox" ${p.isNewDrive ? 'checked' : ''} title="Check if this play starts a new drive">
      <input id="${prefix}yl_${i}" class="play-yl"   type="number" inputmode="numeric" placeholder="-25" value="${p.yl}">
      <input id="${prefix}dn_${i}" class="play-dn"   type="number" inputmode="numeric" placeholder="1"   value="${p.dn}">
      <input id="${prefix}ds_${i}" class="play-dist" type="number" inputmode="numeric" placeholder="10"  value="${p.dist}">
      <input id="${prefix}pc_${i}" class="play-call" type="text"   placeholder="Type call..." value="${p.call}">
      <input id="${prefix}gn_${i}" class="gain"      type="text"   placeholder="Gain/TO" value="${p.gain}">`;
    frag.appendChild(wrap);
  }
  return frag;
}

function renderPlaylists(){
  const off = document.getElementById('offList');
  const def = document.getElementById('defList');
  if (!off && !def) return;

  recalcGains();
  if (off){ off.innerHTML=""; off.appendChild(makeRows(STATE.offPlays, 'off_')); }
  if (def){ def.innerHTML=""; def.appendChild(makeRows(STATE.defPlays, 'def_')); }

  const onInput = (e) => {
    const t = e.target;
    if (t.tagName !== 'INPUT') return;

    const [pre, key, idxStr] = t.id.split('_');
    const idx = Number(idxStr || 0);
    const isOff = pre === 'off';
    const rows = isOff ? STATE.offPlays : STATE.defPlays;
    if (!rows[idx]) rows[idx] = EMPTY_ROW();

    const propMap = { dn: 'dn', ds: 'dist', pc: 'call' };
    let needsRecalc = false;

    // 1. Update state from the changed input
    if (key === 'yl') {
        rows[idx].yl = t.value.trim();
        needsRecalc = true;
    } else if (key === 'nd') {
        rows[idx].isNewDrive = t.checked;
        if (t.checked) { // If the box was just CHECKED, auto-fill DnD
            rows[idx].dn = '1';
            rows[idx].dist = '10';
            const currentDownInput = document.getElementById(`${pre}_dn_${idx}`);
            const currentDistInput = document.getElementById(`${pre}_ds_${idx}`);
            if (currentDownInput) currentDownInput.value = '1';
            if (currentDistInput) currentDistInput.value = '10';
        }
        needsRecalc = true;
    } else if (key === 'gn') {
        const gainValue = t.value.trim().toUpperCase();
        if (gainValue === 'INT' || gainValue === 'TO') {
            rows[idx].gain = gainValue; // Store the string 'INT' or 'TO'
        } else {
            rows[idx].gain = Number(gainValue) || 0; // Keep original behavior for numbers
        }
    } else if (propMap[key]) {
        rows[idx][propMap[key]] = t.value.trim();
    }

    // 2. If yard line or 'new drive' changed, recalculate gains
    if (needsRecalc) {
        recalcGains();
        for (let i = 0; i < rows.length; i++) {
            const gainInput = document.getElementById(`${isOff ? 'off' : 'def'}_gn_${i}`);
            if (gainInput && document.activeElement !== gainInput) {
                gainInput.value = String(rows[i].gain ?? 0);
            }
        }
    }

    // 3. Run auto-fill logic for the *next* row
    const currentPlay = rows[idx];
    const nextPlayIndex = idx + 1;

    if (nextPlayIndex < PLAY_ROWS) {
        const nextPlay = rows[nextPlayIndex];
        if (nextPlay && !nextPlay.isNewDrive) {
            const nextYlInput = document.getElementById(`${pre}_yl_${nextPlayIndex}`);
            const nextDownInput = document.getElementById(`${pre}_dn_${nextPlayIndex}`);
            const nextDistInput = document.getElementById(`${pre}_ds_${nextPlayIndex}`);
            
            const isTurnover = typeof currentPlay.gain === 'string' && (currentPlay.gain === 'INT' || currentPlay.gain === 'TO');

            // A) Auto-fill Yard Line
            const startAbs = parseYardLineToAbsolute(currentPlay.yl);
            // Don't auto-fill YL on turnover, since possession changes
            if (startAbs !== null && !isTurnover) {
                const endAbs = startAbs + Number(currentPlay.gain);
                const nextYlString = absoluteToYardLineString(endAbs);
                if (nextYlString !== null) {
                    nextPlay.yl = nextYlString;
                    if(nextYlInput) nextYlInput.value = nextYlString;
                }
            }
            
            // B) Auto-fill Down & Distance
            if (isTurnover) {
                // Turnover logic
                nextPlay.dn = '1';
                nextPlay.dist = '10';
                if(nextDownInput) nextDownInput.value = '1';
                if(nextDistInput) nextDistInput.value = '10';
            } else {
                // Standard D&D logic
                const dn = parseInt(currentPlay.dn, 10);
                const dist = parseInt(currentPlay.dist, 10);
                const gain = Number(currentPlay.gain);

                if (!isNaN(dn) && !isNaN(dist)) {
                    if (dn >= 4 && gain < dist) {
                        // Turnover on downs
                        nextPlay.dn = '1'; nextPlay.dist = '10';
                        if(nextDownInput) nextDownInput.value = '1';
                        if(nextDistInput) nextDistInput.value = '10';
                    } else if (gain >= dist) {
                        // First down
                        nextPlay.dn = '1'; nextPlay.dist = '10';
                        if(nextDownInput) nextDownInput.value = '1';
                        if(nextDistInput) nextDistInput.value = '10';
                    } else {
                        // Not a first down, advance
                        const nextDn = dn + 1;
                        const nextDist = dist - gain;
                        nextPlay.dn = String(nextDn);
                        nextPlay.dist = String(nextDist);
                        if(nextDownInput) nextDownInput.value = nextDn;
                        if(nextDistInput) nextDistInput.value = nextDist;
                    }
                }
            }
        }
    }
    
    // 4. Save and update analytics
    saveState();
    queueAnalytics();
  };

  off?.addEventListener('input', onInput);
  def?.addEventListener('input', onInput);

  document.getElementById('offClear')?.addEventListener('click', ()=>{
    if (!confirm('Clear ALL offensive plays?')) return;
    STATE.offPlays = Array(PLAY_ROWS).fill(0).map(EMPTY_ROW); renderPlaylists(); saveState(); queueAnalytics();
  });
  document.getElementById('defClear')?.addEventListener('click', ()=>{
    if (!confirm('Clear ALL defensive calls?')) return;
    STATE.defPlays = Array(PLAY_ROWS).fill(0).map(EMPTY_ROW); renderPlaylists(); saveState(); queueAnalytics();
  });
}

// ===== Analytics (UPGRADED) =====
const toInt = (v) => {
  const n = Number(String(v).replace(/[^0-9-]/g,""));
  return Number.isFinite(n) ? n : null;
};

function computeAnalytics(){
  const summarize = (rows, isOff) => {
    const byWord = new Map(), byForm = new Map(), byPlay = new Map(), byCombo = new Map(), byDown = new Map();

    for (const r of rows){
      const dn = toInt(r.dn), dist = toInt(r.dist);
      if (!r.call) continue;
      
      let gain = 0;
      let isTurnover = false;
      if (typeof r.gain === 'string') {
        isTurnover = true;
      } else {
        gain = Number(r.gain || 0);
      }

      const late = (dn===3 || dn===4);
      const offOK = isTurnover ? false : late ? (gain >= (dist ?? 0)) : (gain >= 4);
      const defOK = isTurnover ? true : late ? (gain <  (dist ?? Infinity)) : (gain < 4);
      const success = isOff ? offOK : defOK;
      const isExplosive = gain >= EXPLOSIVE_PLAY_THRESHOLD;

      // --- Keywords
      for (const w of words(r.call)){
        const v = byWord.get(w) || { plays:0, success:0, totalGain:0, explosive:0 };
        v.plays++; if (success) v.success++; if (isExplosive) v.explosive++; v.totalGain += gain; byWord.set(w, v);
      }
      
      const f = detectFormation(r.call);
      const ps = detectPlays(r.call);
      
      // ===== By Down analytics =====
      if (dn && dn >= 1 && dn <= 4) {
          const downKey = `${dn}${dn===1?'st':dn===2?'nd':dn===3?'rd':'th'} Down`;
          const v = byDown.get(downKey) || { plays:0, success:0, totalGain:0, explosive:0 };
          v.plays++; if (success) v.success++; if (isExplosive) v.explosive++; v.totalGain += gain;
          byDown.set(downKey, v);
      }

      // --- Formation
      if (f){
        const v = byForm.get(f) || { plays:0, success:0, totalGain:0, explosive:0 };
        v.plays++; if (success) v.success++; if (isExplosive) v.explosive++; v.totalGain += gain; byForm.set(f, v);
      }
      
      // --- Play
      for (const p of ps){
        const v = byPlay.get(p) || { plays:0, success:0, totalGain:0, explosive:0 };
        v.plays++; if (success) v.success++; if (isExplosive) v.explosive++; v.totalGain += gain; byPlay.set(p, v);
      }

      // --- Formation & Play Combo (Offense only)
      if (isOff && f && ps.length > 0) {
          for (const p of ps) {
            const comboKey = `${f} • ${p}`;
            const v = byCombo.get(comboKey) || { plays:0, success:0, totalGain:0, explosive:0 };
            v.plays++; if (success) v.success++; if (isExplosive) v.explosive++; v.totalGain += gain; byCombo.set(comboKey, v);
          }
      }
    }
    
    const downSorter = (a, b) => a.label.localeCompare(b.label);
    const defaultSorter = (a,b)=> b.succRate - a.succRate || b.explosiveRate - a.explosiveRate || b.avgGain - a.avgGain || b.plays - b.plays || a.label.localeCompare(b.label);

    const finish = (m, sorter = defaultSorter) => [...m.entries()]
      .map(([label, v]) => ({ 
          label, 
          plays: v.plays, 
          succRate: v.success / (v.plays||1), 
          avgGain: v.totalGain / (v.plays||1),
          explosiveRate: v.explosive / (v.plays||1)
      }))
      .filter(r => r.plays >= 1)
      .sort(sorter)
      .slice(0,25);
      
    return { words: finish(byWord), forms: finish(byForm), plays: finish(byPlay), combos: finish(byCombo), down: finish(byDown, downSorter) };
  };
  
  return { off: summarize(STATE.offPlays, true), def: summarize(STATE.defPlays, false) };
}

function queueAnalytics(){ clearTimeout(__analyticsTimer); __analyticsTimer=setTimeout(renderAnalytics,250); }

function renderAnalytics(){
  const container = document.getElementById('analytics-container');
  if (!container) return;
  container.innerHTML = ""; // Clear only analytics
  
  const data = computeAnalytics();
  
  const mkTable = (rows, col0) => rows.length === 0 ? '<p class="muted">No data yet.</p>' : `
    <div class="table-wrapper"><table class="table">
      <thead><tr><th>${col0}</th><th>Plays</th><th>Success %</th><th>Avg Gain</th><th>Explosive %</th></tr></thead>
      <tbody>${
        rows.map(r=>`<tr>
          <td>${r.label}</td>
          <td>${r.plays}</td>
          <td>${(r.succRate*100).toFixed(0)}%</td>
          <td>${r.avgGain.toFixed(1)}</td>
          <td>${(r.explosiveRate*100).toFixed(0)}%</td>
        </tr>`).join('')
      }</tbody>
    </table></div>`;

  const card = (title, html) => {
    const c = document.createElement('div');
    c.className = 'card analytics-card';
    c.innerHTML = `<h2 class="section-title">${title}</h2>${html}`;
    return c;
  };

  // OFFENSE
  if (data.off.combos.length > 0) {
      container.appendChild(card('Offense — By Formation & Play Combo', mkTable(data.off.combos, 'Combination')));
  }
  container.appendChild(card('Offense — By Down', mkTable(data.off.down, 'Down')));
  container.appendChild(card('Offense — By Formation', mkTable(data.off.forms, 'Formation')));
  container.appendChild(card('Offense — By Play', mkTable(data.off.plays, 'Play')));
  container.appendChild(card('Offense — By Keywords', mkTable(data.off.words, 'Word')));

  // DEFENSE
  container.appendChild(card('Defense — By Down', mkTable(data.def.down, 'Down')));
  container.appendChild(card('Defense — By Formation',  mkTable(data.def.forms, 'Formation')));
  container.appendChild(card('Defense — By Play',       mkTable(data.def.plays, 'Play')));
  container.appendChild(card('Defense — By Keywords',  mkTable(data.def.words, 'Word')));
}

// ===== Export CSV =====
function exportPlaysCSV(){
  const safe = (s) => `"${String(s ?? '').replace(/"/g,'""')}"`;
  const hasDF = (typeof detectFormation === 'function');
  const hasDP = (typeof detectPlays === 'function');
  function successFlag(isOff, dn, dist, gain){
    const d = Number(dist ?? 0); 
    const isTurnover = typeof gain === 'string';
    const g = isTurnover ? 0 : Number(gain ?? 0);

    if (isTurnover) return isOff ? false : true;

    if (dn === 3 || dn === 4) return isOff ? (g >= d) : (g < d);
    return isOff ? (g >= 4) : (g < 4);
  }
  function toCSVRow(side, idx, r, isOff){
    if (!r.call && !r.yl) return null; // Skip empty rows
    const f  = hasDF ? (detectFormation(r.call) || '') : '';
    const ps = hasDP ? (detectPlays(r.call).join(' | ')) : '';
    const succ = successFlag(isOff, Number(r.dn||0), r.dist, r.gain) ? 'Y' : 'N';
    return [side, idx, r.isNewDrive ? 'Y' : 'N', safe(r.yl), safe(r.dn), safe(r.dist), safe(r.call), safe(r.gain), safe(f), safe(ps), succ].join(',');
  }
  const lines = ['Side,Index,NewDrive,YardLine,Down,Dist,PlayCall,Result,Formation,PlayNames,Success'];
  STATE.offPlays.forEach((r, i) => { const row = toCSVRow('Offense', i+1, r, true); if (row) lines.push(row); });
  STATE.defPlays.forEach((r, i) => { const row = toCSVRow('Defense', i+1, r, false); if (row) lines.push(row); });
  const touches = STATE.touches ? Object.entries(STATE.touches).map(([k,v])=>`${k}:${v}`).join('; ') : '';
  lines.push(`# Touches: ${touches}`);
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CCS_Game_Plays_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    wireEventListeners();
    document.getElementById('exportPlays')?.addEventListener('click', exportPlaysCSV);
    renderPlaylists();
    renderTouchCounter();
    renderTimeoutsSummary();
    updateClockHelper();
    run();
});
