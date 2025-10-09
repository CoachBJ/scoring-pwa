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

function detectFormation(call){
  const nc = _norm(call);
  // pick FIRST best match (longest norm first for specificity)
  let best = null;
  for (const f of _FORM_KEYS.sort((a,b)=>b.norm.length-a.norm.length)){
    if (nc.includes(f.norm)){ best = f.raw; break; }
  }
  return best || null;
}
function detectPlays(call){
  const nc = _norm(call);
  const hits = [];
  for (const p of _PLAY_KEYS){
    if (nc.includes(p.norm)) hits.push(p.raw);
  }
  // de-dup and cap (avoid overly long rows)
  return [...new Set(hits)].slice(0,3);
}






const TEAM_NAME = "Charlotte Christian";
const MAX_RESULTS = 200;
const MAX_TIME_SECS = 12 * 60; // 12 minute maximum for the clock
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

// Helper: read CSS vars (e.g., --primary-color, --opp)
function cssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// Helper: theme the clock result based on who has ball
function setClockResultTheme(weHaveBall){
  const bg = weHaveBall ? cssVar('--primary-color') : cssVar('--opp');
  const fg = weHaveBall ? getContrastColor(bg) : cssVar('--opp-text') || getContrastColor(bg);
  if (elClockResult){
    elClockResult.style.background = bg || '#005a9c';
    elClockResult.style.color = fg || '#fff';
  }
}


// --- Robust helpers ---
function safeIsHalf2() {
  // If the radio isn’t mounted yet, default to 1st half (safe)
  return !!(typeof elHalf2 !== 'undefined' && elHalf2 && elHalf2.checked);
}
function safeGetGroupEl(key) {
  return document.querySelector(`.to-card[data-key="${key}"] .to-checks`) || null;
}
function getTOState(key) {
  const g = safeGetGroupEl(key);
  if (!g) return [true, true, true]; // default: 3 available if group missing
  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  // If boxes somehow missing, fall back to 3 available
  return boxes.length ? boxes.map(b => !!b.checked) : [true, true, true];
}
function countTO(key) {
  const arr = getTOState(key);
  return Array.isArray(arr) ? arr.filter(Boolean).length : 3;
}

// --- Safer timeout summary (no crashes) ---
function renderTimeoutsSummary() {
  if (!elOurTOLeft || !elOppTOLeft) return;
  const half2 = safeIsHalf2();
  elOurTOLeft.textContent = String(half2 ? countTO("our-h2") : countTO("our-h1"));
  elOppTOLeft.textContent = String(half2 ? countTO("opp-h2") : countTO("opp-h1"));
  if (elOppTOName) elOppTOName.textContent = STATE.oppName || "Opponent";
}

// --- Safer clock math (guards every read) ---
function updateClockHelper() {
  try {
    const timeLeft = getTimeSecs(); // already clamped & null-safe
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
    if (elClockResult) {
      elClockResult.textContent = 'Clock helper paused due to an input error. Fix inputs or toggle half to refresh.';
    }
  } finally {
    renderTimeoutsSummary(); // keep scoreboard in sync
    if (window.__recalcTwoPointDecision) window.__recalcTwoPointDecision();
  }
}




// --- One-tap Use TO (no-throw even at 0) ---
function useTO(side) {
  const half2 = safeIsHalf2();
  const key = `${side}-${half2 ? 'h2' : 'h1'}`;
  const g = safeGetGroupEl(key);
  if (!g) { renderTimeoutsSummary(); updateClockHelper(); return; }

  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  if (!boxes.length) { renderTimeoutsSummary(); updateClockHelper(); return; }

  // Find last available TO and mark it used
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

// Opponent profile
function applyOpponentProfile(){
  elOppName.value = STATE.oppName;
  elOppColor.value = STATE.oppColor;

  const oppTextColor = getContrastColor(STATE.oppColor);
  const root = document.documentElement;
  root.style.setProperty('--opp', STATE.oppColor);
  root.style.setProperty('--opp-text', oppTextColor);

  elOppLabel.textContent = STATE.oppName;
  elOurLabel.textContent = TEAM_NAME;

  // “Opponent has ball” dynamic label
  const elBallThemName = document.getElementById('ballThemName');
  if (elBallThemName) elBallThemName.textContent = STATE.oppName || "Opponent";
  if (elOppTOName) elOppTOName.textContent = STATE.oppName || "Opponent";
  if (elOppNameTO) elOppNameTO.textContent = STATE.oppName || "Opponent";



  // KO label inline name
  if (elOppNameInline) elOppNameInline.textContent = STATE.oppName || "Opponent";

  // Timeout headings
  updateTOHeadings();
}



const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toMMSS = (s) => { s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), ss=s%60; return `${m}:${String(ss).padStart(2,"0")}`; };

// This function determines if a color is light or dark for text contrast
function getContrastColor(hex) {
    if (!hex) return '#ffffff';
    // Handle short hex codes like #F0C
    if (hex.length === 4) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff'; // Return black for light colors, white for dark
}

// ===== Turnovers (per-type, both teams on one line) =====

// IDs map
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

// Compute elite TO margin:  (our takeaways) − (our giveaways)
// our takeaways   = our.fumRec + opp.intThrown
// our giveaways   = our.fumLost + our.intThrown
function computeTOMargin(){
  const t = STATE.turnovers;
  const ourTake  = clampNonNeg(t.our.fumRec) + clampNonNeg(t.opp.intThrown);
  const ourGive  = clampNonNeg(t.our.fumLost) + clampNonNeg(t.our.intThrown);
  return ourTake - ourGive;
}

function renderTurnovers(){
  // push values into the UI
  for (const side of ['our','opp']){
    for (const key of ['fumLost','fumRec','intThrown']){
      const id = TO_IDS[side][key].val;
      const el = document.getElementById(id);
      if (el) el.textContent = clampNonNeg(STATE.turnovers[side][key]);
    }
  }
  // update margin chip
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
    const cur = clampNonNeg(STATE.turnovers[side][key]);
    STATE.turnovers[side][key] = clampNonNeg(cur + delta);

    // Mirror fumbles lost <-> opponent fumbles recovered
    if (key === 'fumLost' && delta !== 0) {
      const other = mirror(side);
      const curRec = clampNonNeg(STATE.turnovers[other].fumRec);
      STATE.turnovers[other].fumRec = clampNonNeg(curRec + delta);
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

  // Try standard mm:ss format first
  const classicMatch = str.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (classicMatch) {
    const m = parseInt(classicMatch[1], 10);
    const s = parseInt(classicMatch[2], 10);
    return clamp(m * 60 + s, 0, MAX_TIME_SECS);
  }

  // Try numeric-only format (e.g., 130 -> 1:30, 45 -> 0:45)
  const numericOnly = str.replace(/\D/g, '');
  if (numericOnly.length > 0 && numericOnly.length <= 4) {
    let m = 0, s = 0;
    if (numericOnly.length <= 2) { // "45" -> 45s
      s = parseInt(numericOnly, 10);
    } else if (numericOnly.length === 3) { // "130" -> 1m 30s
      m = parseInt(numericOnly.substring(0, 1), 10);
      s = parseInt(numericOnly.substring(1), 10);
    } else { // "1200" -> 12m 0s
      m = parseInt(numericOnly.substring(0, 2), 10);
      s = parseInt(numericOnly.substring(2), 10);
    }

    if (s >= 60 || m > 12) return null; // Invalid time like 1m 75s or 13m

    return clamp(m * 60 + s, 0, MAX_TIME_SECS);
  }

  return null; // Format not recognized
};

// ----- Scoring core -----
function updateSecondHalfInfo(){
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

// ----- DOM refs: scores/options -----
const elOur = document.querySelector("#ourScore");
const elOpp = document.querySelector("#oppScore");
const elOut = document.querySelector("#output");
const elStatus=document.querySelector("#status");
const viewTable=document.querySelector("#view-table");
const viewRow  =document.querySelector("#view-row");
const elOurLabel=document.querySelector("#ourLabel");
const elOppLabel=document.querySelector("#oppLabel");
const elClearOfficials = document.getElementById("clearOfficials");

// ----- New DOM refs: KO + Officials -----
const elWeKO = document.getElementById("weReceivedKO");
const elOppKO = document.getElementById("oppReceivedKO");
const elSecondHalfInfo = document.getElementById("secondHalfInfo");
const elOppNameInline = document.getElementById("oppNameInline");


const elHeadRef = document.getElementById("headRef");
const elSideJudge = document.getElementById("sideJudge");
const elHeadRefDisplay = document.getElementById("headRefDisplay");
const elSideJudgeDisplay = document.getElementById("sideJudgeDisplay");
const elOfficialsDisplay = document.getElementById("officialsDisplay");


// Opponent/theme inputs
const elOppName=document.getElementById("oppName");
const elOppColor=document.getElementById("oppColor");

// ----- Banner -----
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

// ----- Renderers -----
function renderRow(list){
  const card=document.createElement("div"); card.className="card";
  const row=document.createElement("div"); row.className = "score-options-cell";
  list.forEach((it,idx)=>{
    it.txt.split(JOINER).forEach(seg=>{ const span=document.createElement("span"); span.className="segment"; span.textContent=seg; row.appendChild(span); });
    if(idx<list.length-1){ const sep=document.createElement("span"); sep.textContent="|"; sep.className="muted"; row.appendChild(sep); }
  });
  card.appendChild(row); elOut.appendChild(card);
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
  table.appendChild(tb); card.appendChild(table); elOut.appendChild(card);
}
function renderSection(title, resultObj){
  const header=document.createElement("h2"); header.className="section-title"; header.style.marginTop = '20px'; header.textContent = title; elOut.appendChild(header);
  if(resultObj.msg){ const card=document.createElement("div"); card.className="card"; card.innerHTML=`<span class="muted">${resultObj.msg}</span>`; elOut.appendChild(card); }
  else { (viewTable.checked?renderTable:renderRow)(resultObj.list); }
}


function renderOfficials(){
  const hr = STATE.officials.headRef?.trim();
  const sj = STATE.officials.sideJudge?.trim();
  if (elHeadRefDisplay)   elHeadRefDisplay.textContent   = hr ? `Head Ref: ${hr}` : "";
  if (elSideJudgeDisplay) elSideJudgeDisplay.textContent = sj ? `Side Judge (our sideline): ${sj}` : "";
  const any = !!(hr || sj);
  if (elOfficialsDisplay) elOfficialsDisplay.style.display = any ? "grid" : "none";
}


// ===== Game clock / TOs (checkbox groups) =====
const elHalf1=document.getElementById("half1");
const elHalf2=document.getElementById("half2");
const elTimeInput=document.getElementById("timeInput");
const elMiniBtns = document.querySelectorAll('.mini[data-dt]');
const elOppNameTO = document.getElementById("oppNameTO"); // for the TO line label

document.addEventListener('DOMContentLoaded', () => {
  const n = document.getElementById('toOppName');
  if (n) n.textContent = (window.STATE?.oppName) || 'Opponent';
});



function getGroupEl(key){ return document.querySelector(`.to-card[data-key="${key}"] .to-checks`); }
function setTOState(key, arr){
  const g = safeGetGroupEl(key);
  if (!g) return;
  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  boxes.forEach((b,i)=>{ b.checked = (arr && typeof arr[i]==="boolean") ? arr[i] : true; });
}

function getTimeSecs(){ const s=fromMMSS(elTimeInput.value); return s==null?0:s; }
function setTimeSecs(secs){ elTimeInput.value = toMMSS(clamp(secs,0,MAX_TIME_SECS)); }

elMiniBtns.forEach(b=>{
  b.addEventListener("click", ()=>{
    let secs = getTimeSecs();
    secs = clamp(secs + Number(b.dataset.dt), 0, MAX_TIME_SECS);
    setTimeSecs(secs); saveState(); updateClockHelper();
  });
});
elTimeInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ commitManualTime(); }});
elTimeInput.addEventListener("blur", commitManualTime);
elTimeInput.addEventListener("focus", ()=>{ elTimeInput.select(); });

function commitManualTime(){
  const secs=fromMMSS(elTimeInput.value);
  if(secs==null){ elTimeInput.classList.add("error"); return; }
  elTimeInput.classList.remove("error");
  setTimeSecs(secs); saveState(); updateClockHelper();
}

// One-tap Use TO
function bindLongPressTO(btnId, side) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  let t = null;

  const fire = () => {
    useTO(side);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  // Prevent iOS long-press callout
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  btn.addEventListener('pointerdown', (e) => {
    btn.classList.add('btn-pressing');
    t = setTimeout(fire, 350); // slightly faster than 500ms
  });
  ['pointerup','pointerleave','pointercancel'].forEach(ev => {
    btn.addEventListener(ev, () => {
      btn.classList.remove('btn-pressing');
      if (t) { clearTimeout(t); t = null; }
    });
  });

  // Optional quick tap fallback if you want it:
  // btn.addEventListener('click', fire);

  // Keep dblclick as secondary
  btn.addEventListener('dblclick', fire);
}




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

// Quick score buttons
document.querySelectorAll('.chip').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const team = btn.dataset.team; const delta = Number(btn.dataset.delta||0);
    const our = Number(elOur.value||0), opp = Number(elOpp.value||0);
    if(team==='our'){ elOur.value = our + delta; }
    else { elOpp.value = opp + delta; }
    saveState(); run();
  });
});

// ----- Clock helper -----
const elBallUs=document.getElementById("ballUs");
const elBallThem=document.getElementById("ballThem");
const elSnaps=document.getElementById("snaps");
const elPlayClock=document.getElementById("playClock");
const elPlayTime=document.getElementById("playTime");
const elClockResult=document.getElementById("clockResult");

[elBallUs, elBallThem, elSnaps, elPlayClock, elPlayTime, elHalf1, elHalf2]
  .filter(Boolean)
  .forEach(el => {
    el.addEventListener("change", () => { saveState(); updateClockHelper(); });
    el.addEventListener("input",  () => { updateClockHelper(); });
  });



// ----- State -----
const STATE_KEY = "ccs-gamemanager-state-v3";
let STATE = {
  oppName: "Opponent",
  oppColor: "#9a9a9a",
  collapsedTO: {},
  openingKO: null,
  officials: { headRef: "", sideJudge: "" },
  // FIX: object shape, not numbers
  turnovers: {
    our: { fumLost: 0, fumRec: 0, intThrown: 0 },
    opp: { fumLost: 0, fumRec: 0, intThrown: 0 }
  }
};

function saveState(){
  document.querySelectorAll('.to-card[data-key]').forEach(card=>{
    STATE.collapsedTO[card.dataset.key] = card.classList.contains('collapsed');
  });
  STATE.openingKO = (elWeKO?.checked) ? "we" : ((elOppKO?.checked) ? "opp" : null);

  const s = {
    our: Number(elOur.value||0),
    opp: Number(elOpp.value||0),
    half: elHalf2.checked ? 2 : 1,
    time: getTimeSecs(),
    to: {
      "our-h1": getTOState("our-h1"),
      "opp-h1": getTOState("opp-h1"),
      "our-h2": getTOState("our-h2"),
      "opp-h2": getTOState("opp-h2")
    },
    oppName:   STATE.oppName,
    oppColor:  STATE.oppColor,
    collapsedTO: STATE.collapsedTO,
    openingKO:  STATE.openingKO,
    officials:  STATE.officials,
    turnovers:  STATE.turnovers,
    // NEW: persist playlists
    offPlays:   STATE.offPlays,
    defPlays:   STATE.defPlays
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}


function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");

    // scores & half
    if (elOur) elOur.value = s.our ?? 0;
    if (elOpp) elOpp.value = s.opp ?? 0;

    // ✅ guard half radios in case they’re not mounted yet
    const halfEl = (s.half === 2 && elHalf2) ? elHalf2 : elHalf1;
    if (halfEl) halfEl.checked = true;

    setTimeSecs(typeof s.time === "number" ? s.time : MAX_TIME_SECS);

    // timeouts
    if (s.to) Object.keys(s.to).forEach(k => setTOState(k, s.to[k]));
    else ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k => setTOState(k,[true,true,true]));

    // collapsed TO cards
    STATE.collapsedTO = s.collapsedTO || {};
    Object.keys(STATE.collapsedTO).forEach(key => {
      const card = document.querySelector(`.to-card[data-key="${key}"]`);
      if (card && STATE.collapsedTO[key]) card.classList.add('collapsed');
    });

    // opponent profile
    STATE.oppName  = s.oppName  || "Opponent";
    STATE.oppColor = s.oppColor || "#9a9a9a";

    // ✅ migrate to multi-field rows
    STATE.offPlays = migrateRows(s.offPlays);
    STATE.defPlays = migrateRows(s.defPlays);

    applyOpponentProfile();

    // opening KO + officials
    STATE.openingKO = s.openingKO || null;
    if (elWeKO)  elWeKO.checked  = STATE.openingKO === "we";
    if (elOppKO) elOppKO.checked = STATE.openingKO === "opp";

    STATE.officials = s.officials || { headRef: "", sideJudge: "" };
    if (elHeadRef)   elHeadRef.value   = STATE.officials.headRef   || "";
    if (elSideJudge) elSideJudge.value = STATE.officials.sideJudge || "";

    // turnovers migration
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

    // render
    renderTurnovers();
    updateSecondHalfInfo();
    renderOfficials();

  } catch(e){
    console.error("Failed to load state", e);
    setTimeSecs(MAX_TIME_SECS);
    ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k => setTOState(k,[true,true,true]));
    renderTurnovers();
    updateSecondHalfInfo();
    renderOfficials();
  }
}




// Opening KO radios
[elWeKO, elOppKO].filter(Boolean).forEach(r => {
  r.addEventListener("change", () => {
    STATE.openingKO = elWeKO?.checked ? "we" : (elOppKO?.checked ? "opp" : null);
    updateSecondHalfInfo();
    saveState();
  });
});


// Officials text boxes (autosave + live display)
[elHeadRef, elSideJudge].filter(Boolean).forEach(inp => {
  inp.addEventListener('input', () => {
    STATE.officials.headRef   = elHeadRef?.value.trim()   || "";
    STATE.officials.sideJudge = elSideJudge?.value.trim() || "";
    renderOfficials();
    saveState();
  });
});


// Opponent/theme inputs
elOppName.addEventListener('input', () => {
  STATE.oppName = elOppName.value || 'Opponent';
  applyOpponentProfile();
  updateClockHelper();      // <-- add this line
  saveState();
  run();
});

elOppColor.addEventListener('input', () => {
  STATE.oppColor = elOppColor.value;
  applyOpponentProfile();
  updateClockHelper();      // <-- add this line
  saveState();
});


// ----- Main scoring run -----
[elOur,elOpp].forEach(el=>el.addEventListener("input", run));
[viewTable, viewRow].forEach(el => el.addEventListener('change', run));

// Prevents scores from being negative
[elOur, elOpp].forEach(el => {
    el.addEventListener('change', () => {
        const score = parseInt(el.value, 10);
        if (isNaN(score) || score < 0) {
            el.value = 0;
            run(); // Rerun to update calculations after correction
        }
    });
});

function run(){
  elOut.innerHTML=""; elStatus.textContent="";

  const our=validateInt(elOur.value);
  const opp=validateInt(elOpp.value);
  if(our==null || opp==null){ elStatus.textContent="Enter both scores."; return; }

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
     elOut.innerHTML = "";
  }
  if (window.__recalcTwoPointDecision) window.__recalcTwoPointDecision();
  saveState();
  queueAnalytics(); // <— add this
}

// ----- Init -----
document.getElementById("resetGame").addEventListener("click", ()=>{
  if (confirm('Are you sure you want to reset the entire game?')) {
    localStorage.removeItem(STATE_KEY); // Clear saved state from storage
    elOur.value=0;
    elOpp.value=0;
    elOppName.value = "Opponent";
    elOppColor.value = "#9a9a9a";
    STATE.oppName = "Opponent";
    STATE.oppColor = "#9a9a9a";
    applyOpponentProfile();
    document.getElementById("half1").checked=true;
    setTimeSecs(MAX_TIME_SECS);
    ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true]));
    STATE.collapsedTO = {};
    // Clear KO radios
if (elWeKO)  elWeKO.checked = false;
if (elOppKO) elOppKO.checked = false;
STATE.openingKO = null;
updateSecondHalfInfo();

// Clear officials
if (elHeadRef)   elHeadRef.value   = "";
if (elSideJudge) elSideJudge.value = "";
STATE.officials = { headRef: "", sideJudge: "" };
STATE.turnovers = {
  our: { fumLost: 0, fumRec: 0, intThrown: 0 },
  opp: { fumLost: 0, fumRec: 0, intThrown: 0 }
};
 // NEW
renderTurnovers();                      // NEW
renderOfficials();
saveState();

    document.querySelectorAll('.to-card.collapsed').forEach(c => c.classList.remove('collapsed'));
    run();
    updateClockHelper();
  }
});

// Event listeners for collapsible sections
document.querySelectorAll('.to-title').forEach(title => {
  title.addEventListener('click', () => {
    const card = title.closest('.to-card[data-key]');
    if (card) {
        card.classList.toggle('collapsed');
        saveState();
    }
  });
});

// Event listeners for manual timeout checkbox changes
document.querySelectorAll('.to-checks input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        saveState();
        updateClockHelper();
    });
});


// --- Wire up "Use TO" buttons (tap + long-press + keyboard) ---
(function wireUseTOButtons() {
  const hook = (id, side) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    const fire = () => { useTO(side); if (navigator.vibrate) navigator.vibrate(20); };

    // Single tap
    btn.addEventListener('click', fire);

    // Prevent iOS text callout on long-press
    btn.addEventListener('contextmenu', (e) => e.preventDefault());

    // Long-press
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

    // Optional: dblclick as backup
    btn.addEventListener('dblclick', fire);
  };

  hook('useOurTO','our');
  hook('useOppTO','opp');
})();

// ===== 2-Point Decision (after TD) =====
(function twoPointModule(){
  const elXP  = document.getElementById('xpRate');
  const el2P  = document.getElementById('twoPtRate');
  const elRes = document.getElementById('twoPtResult');
  const elMath= document.getElementById('twoPtMath'); // NEW
  const btnRe = document.getElementById('recalcTwoPt');
  if (!elXP || !el2P || !elRes) return;

  // Quick chart overrides (after adding 6 for TD)
  const CRIT = {
    '-25': "🟢 GO FOR 2 » Goal: down 23 (3-score window)",
    '-24': "🟢 GO FOR 2 » Move to -22 (improves path)",
    '-23': "🟢 GO FOR 2 » Goal: down 21 (clean 3 TDs)",
    '-20': "🟢 GO FOR 2 » Goal: down 18 (clean 3 TDs)",
    '-18': "🟢 GO FOR 2 » Down 16 clarifies path (2 TD + 2×2pt)",
    '-17': "🟢 GO FOR 2 » Reduces needed 2PCs later (to -15)",
    '-16': "🟢 GO FOR 2 » Goal: down 14 (clean 2 TDs)",
    '-13': "🟢 GO FOR 2 » Create TD+FG game (to -11)",
    '-10': "🟢 GO FOR 2 » Make it one-score (down 8)",
    '-9':  "🟢 GO FOR 2 » Make it one-score (down 7)",
    '-5':  "🟢 GO FOR 2 » Get to FG game (down 3)",
    '-2':  "🟢 GO FOR 2 » Tie it",
    '1':   "🟢 GO FOR 2 » Up 3 (FG only ties)",
    '4':   "🟢 GO FOR 2 » Up 6 > up 5 vs opp TD",
    '5':   "🟢 GO FOR 2 » Up 7 (true one-score)",
    '12':  "🟢 GO FOR 2 » Up 14 (two-score standard)",
    '14':  "🟢 GO FOR 2 » Up 16 (requires 2 TD + 2×2pt to tie)",
    '19':  "🟢 GO FOR 2 » Up 21 (three-score standard)",
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

    // After the TD only (no try yet)
    const diffAfterTD = (our - opp) + 6;

    const ep2 = 2 * tp; // expected points for going for 2
    const epp = 1 * xp; // expected points for PAT

    // --- your existing final decision logic (unchanged) ---
    const timeLeft = getTimeSecs();
    const late = safeIsHalf2() || timeLeft <= 120;

    let final = CRIT[String(diffAfterTD)] || '';
    if (!final) {
      if (late) {
        final = (ep2 > epp)
          ? `🟡 GO FOR 2 (Situational) » EP ${ep2.toFixed(2)} vs ${epp.toFixed(2)}`
          : `🔴 KICK PAT » EP ${epp.toFixed(2)} vs ${ep2.toFixed(2)}`;
      } else {
        final = (ep2 > epp)
          ? `🟢 GO FOR 2 » EP ${ep2.toFixed(2)} vs ${epp.toFixed(2)}`
          : `🔴 KICK PAT » EP ${epp.toFixed(2)} vs ${ep2.toFixed(2)}`;
      }
    }

    elRes.textContent = final;
    elRes.className = `two-pt-result ${classify(final)}`;

    // --- NEW: show the math and the up/down line just below ---
    if (elMath){
      const line1 = `Math: EP(2-pt) = 2 × ${(tp*100).toFixed(0)}% = <b>${ep2.toFixed(2)}</b> • EP(PAT) = 1 × ${(xp*100).toFixed(0)}% = <b>${epp.toFixed(2)}</b>`;
      let line2 = '';
      if (diffAfterTD > 0)  line2 = `After TD: <b>Charlotte Christian will be UP by ${diffAfterTD}</b>.`;
      else if (diffAfterTD < 0) line2 = `After TD: <b>Charlotte Christian will be DOWN by ${Math.abs(diffAfterTD)}</b>.`;
      else line2 = `After TD: <b>Game would be TIED</b>.`;
      elMath.innerHTML = `${line1}<br>${line2}`;
    }
  }

  btnRe?.addEventListener('click', calcTwoPointDecision);
  [elXP, el2P].forEach(inp => inp?.addEventListener('input', calcTwoPointDecision));
  window.__recalcTwoPointDecision = calcTwoPointDecision;
})();





// ===== Offensive Touch Counter =====
const DEFAULT_ROSTER = [
  // Edit these ~20 names as you like
  "RB1", "WR1", "WR2", "WR3", "TE1",
  "QB1", "RB2", "WR4", "TE2", "Slot",
  "FB", "H-Back", "Wing", "RB3", "WR5",
  "KR/WR", "PR/WR", "Utility", "Motion", "Jet"
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

  // Wire +/−
  list.querySelectorAll('.tc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      const d = Number(btn.getAttribute('data-d'));
      bumpTouch(name, d);
    });
  });

  // Reset button
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
  saveState();
  // update total quickly
  const total = Object.values(STATE.touches).reduce((a,b)=>a + (Number(b)||0), 0);
  const totalEl = document.getElementById('tcTotal');
  if (totalEl) totalEl.textContent = String(total);
  if (navigator.vibrate) navigator.vibrate(10);
}


document.addEventListener('DOMContentLoaded', () => {
  ensureTouchState();
  renderTouchCounter();
  renderPlaylists();
});






// ===== Playlists (Offense / Defense) — multi-field with auto gain + analytics =====
const PLAY_ROWS = 75;
const EMPTY_ROW = () => ({ yl:"", dn:"", dist:"", hash:"", call:"", gain:0 });

function migrateRows(arr){
  if (!Array.isArray(arr)) return Array(PLAY_ROWS).fill(0).map(EMPTY_ROW);
  return arr.map(v => (v && typeof v === 'object')
    ? { yl:v.yl??"", dn:v.dn??"", dist:v.dist??"", hash:v.hash??"", call:v.call??"", gain:Number(v.gain||0) }
    : { ...EMPTY_ROW(), call:String(v||"") }
  ).concat(Array(Math.max(0, PLAY_ROWS - arr.length)).fill(0).map(EMPTY_ROW)).slice(0, PLAY_ROWS);
}

STATE.offPlays = migrateRows(STATE.offPlays);
STATE.defPlays = migrateRows(STATE.defPlays);

const toInt = (v) => {
  const n = Number(String(v).replace(/[^0-9-]/g,""));
  return Number.isFinite(n) ? n : null;
};

function recalcGains(){
  const calc = (rows, isOff) => {
    for (let i=0;i<rows.length;i++){
      const cur = toInt(rows[i].yl);
      const nxt = (i+1<rows.length) ? toInt(rows[i+1].yl) : null;
      let g = 0;
      if (cur!=null && nxt!=null) g = nxt - cur;  // + = moved toward opponent goal
      rows[i].gain = isOff ? g : Math.max(0, g);  // defense stores yards allowed as + for clarity
    }
  };
  calc(STATE.offPlays, true);
  calc(STATE.defPlays, false);
}

function playHeadRow(){
  const head = document.createElement('div');
  head.className = 'play-head';
  head.innerHTML = `<div>#</div><div>YL</div><div>Dn</div><div>Dist</div><div>Hash</div><div>Play Call</div><div>Gain</div>`;
  return head;
}

function makeRows(arr, prefix){
  const frag = document.createDocumentFragment();
  frag.appendChild(playHeadRow());
  for (let i=0;i<PLAY_ROWS;i++){
    const p = arr[i] || EMPTY_ROW();
    const wrap = document.createElement('div');
    wrap.className = 'play-row';
    wrap.innerHTML = `
      <div class="idx">${i+1}</div>
      <input id="${prefix}yl_${i}"   class="play-yl"   type="number" inputmode="numeric" placeholder="35" value="${p.yl}">
      <input id="${prefix}dn_${i}"   class="play-dn"   type="number" inputmode="numeric" placeholder="1"  value="${p.dn}">
      <input id="${prefix}ds_${i}"   class="play-dist" type="number" inputmode="numeric" placeholder="10" value="${p.dist}">
      <input id="${prefix}hs_${i}"   class="play-hash" type="text"   placeholder="L/M/R" value="${p.hash}">
      <input id="${prefix}pc_${i}"   class="play-call" type="text"   placeholder="Type call..." value="${p.call}">
      <div  id="${prefix}gn_${i}"   class="gain">${Number(p.gain||0)}</div>`;
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
    const t = e.target; if (t.tagName !== 'INPUT') return;
    const [pre, key, idxStr] = t.id.split('_'); const idx = Number(idxStr||0);
    const isOff = pre === 'off'; const rows = isOff ? STATE.offPlays : STATE.defPlays;
    if (!rows[idx]) rows[idx] = EMPTY_ROW();

    if (key==='yl') rows[idx].yl = t.value.trim();
    if (key==='dn') rows[idx].dn = t.value.trim();
    if (key==='ds') rows[idx].dist = t.value.trim();
    if (key==='hs') rows[idx].hash = t.value.trim();
    if (key==='pc') rows[idx].call = t.value.trim();

    recalcGains();
    const gCell = document.getElementById(`${isOff?'off':'def'}_gn_${idx}`);
    if (gCell) gCell.textContent = String(rows[idx].gain ?? 0);
    const prev = idx-1;
    if (prev>=0){
      const gPrev = document.getElementById(`${isOff?'off':'def'}_gn_${prev}`);
      if (gPrev) gPrev.textContent = String(rows[prev].gain ?? 0);
    }
    saveState(); queueAnalytics();
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

// ===== ADVANCED analytics by play-call words =====
function computeAnalytics(){
  const summarize = (rows, isOff) => {
    const byWord = new Map();
    const byForm = new Map();
    const byPlay = new Map();

    for (const r of rows){
      const dn   = toInt(r.dn);
      const dist = toInt(r.dist);
      const gain = Number(r.gain||0);

      const late   = (dn===3 || dn===4);
      const offOK  = late ? (gain >= (dist ?? 0)) : (gain >= 4);
      const defOK  = late ? (gain <  (dist ?? Infinity)) : (gain < 4);
      const success= isOff ? offOK : defOK;
      const gForAvg= isOff ? gain : (0 - gain); // defense: less allowed is better

      // --- keywords (existing behavior)
      for (const w of words(r.call)){
        const v = byWord.get(w) || { plays:0, success:0, totalGain:0 };
        v.plays++; if (success) v.success++; v.totalGain += gForAvg;
        byWord.set(w, v);
      }

      // --- formation
      const f = detectFormation(r.call);
      if (f){
        const v = byForm.get(f) || { plays:0, success:0, totalGain:0 };
        v.plays++; if (success) v.success++; v.totalGain += gForAvg;
        byForm.set(f, v);
      }

      // --- play names (can be multiple)
      for (const p of detectPlays(r.call)){
        const v = byPlay.get(p) || { plays:0, success:0, totalGain:0 };
        v.plays++; if (success) v.success++; v.totalGain += gForAvg;
        byPlay.set(p, v);
      }
    }

    const finish = (m) => [...m.entries()]
      .map(([label, v]) => ({
        label,
        plays: v.plays,
        succRate: v.success/(v.plays||1),
        avgGain: v.totalGain/(v.plays||1)
      }))
      .filter(r => r.plays >= 1)
      .sort((a,b)=> b.succRate - a.succRate || b.avgGain - a.avgGain || a.label.localeCompare(b.label))
      .slice(0,25);

    return {
      words: finish(byWord),
      forms: finish(byForm),
      plays: finish(byPlay)
    };
  };

  return {
    off: summarize(STATE.offPlays, true),
    def: summarize(STATE.defPlays, false)
  };
}

function queueAnalytics(){ clearTimeout(__analyticsTimer); __analyticsTimer=setTimeout(renderAnalytics,120); }

function renderAnalytics(){
  const out = document.getElementById('output');
  if (!out) return;

  // clear old cards
  out.querySelectorAll('.analytics-card').forEach(c => c.remove());

  const data = computeAnalytics();
  const mkTable = (rows, col0) => `
    <table class="table">
      <thead><tr><th>${col0}</th><th>Plays</th><th>Success %</th><th>Avg Gain</th></tr></thead>
      <tbody>${
        rows.map(r=>`<tr>
          <td>${r.label ?? r.word}</td>
          <td>${r.plays}</td>
          <td>${(r.succRate*100).toFixed(0)}%</td>
          <td>${r.avgGain.toFixed(2)}</td>
        </tr>`).join('')
      }</tbody>
    </table>`;

  const card = (title, html) => {
    const c = document.createElement('div');
    c.className = 'card analytics-card';
    c.innerHTML = `<h2 class="section-title">${title}</h2>${html}`;
    return c;
  };

  // OFFENSE
  out.appendChild(card('Offense — By Formation', mkTable(data.off.forms, 'Formation')));
  out.appendChild(card('Offense — By Play',       mkTable(data.off.plays, 'Play')));
  out.appendChild(card('Offense — Keywords',      mkTable(data.off.words.map(x=>({ ...x, label:x.word })), 'Word')));

  // DEFENSE
  out.appendChild(card('Defense — By Formation',  mkTable(data.def.forms, 'Formation')));
  out.appendChild(card('Defense — By Play',       mkTable(data.def.plays, 'Play')));
  out.appendChild(card('Defense — Keywords',      mkTable(data.def.words.map(x=>({ ...x, label:x.word })), 'Word')));
}




// ===== Export CSV (multi-field rows) =====
function exportPlaysCSV(){
  const safe = (s) => `"${String(s ?? '').replace(/"/g,'""')}"`;

  // Fallbacks in case detectFormation/detectPlays aren't defined yet
  const hasDF = (typeof detectFormation === 'function');
  const hasDP = (typeof detectPlays === 'function');
  const _norm = s => String(s||'').toLowerCase().replace(/\s+/g,' ').trim();

  function successFlag(isOff, dn, dist, gain){
    const d = Number(dist ?? 0);
    const g = Number(gain ?? 0);
    if (dn === 3 || dn === 4) {
      return isOff ? (g >= d) : (g < d);
    }
    // 1st/2nd down heuristic: 4+ is a win for O, <4 is a win for D
    return isOff ? (g >= 4) : (g < 4);
  }

  function toCSVRow(side, idx, r, isOff){
    const f = hasDF ? (detectFormation(r.call) || '') : '';
    const ps = hasDP ? (detectPlays(r.call).join(' | ')) : '';
    const succ = successFlag(isOff, Number(r.dn||0), r.dist, r.gain) ? 'Y' : 'N';

    return [
      side,
      idx,
      safe(r.yl),
      safe(r.dn),
      safe(r.dist),
      safe(r.hash),
      safe(r.call),
      (r.gain ?? 0),
      safe(f),
      safe(ps),
      succ
    ].join(',');
  }

  const lines = [];
  lines.push('Side,Index,YardLine,Down,Dist,Hash,PlayCall,Gain,Formation,PlayNames,Success');

  for (let i = 0; i < PLAY_ROWS; i++){
    const r = STATE.offPlays[i] || {};
    lines.push(toCSVRow('Offense', i+1, r, true));
  }
  for (let i = 0; i < PLAY_ROWS; i++){
    const r = STATE.defPlays[i] || {};
    lines.push(toCSVRow('Defense', i+1, r, false));
  }

  // Touches summary as a final comment row (kept)
  const touches = STATE.touches ? Object.entries(STATE.touches).map(([k,v])=>`${k}:${v}`).join('; ') : '';
  lines.push(`# Touches: ${touches}`);

  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CCS_Game_Plays_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}

  // Optional: touches summary as a final comment row
  const touches = STATE.touches ? Object.entries(STATE.touches).map(([k,v])=>`${k}:${v}`).join('; ') : '';
  lines.push(`# Touches: ${touches}`);

  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `CCS_Game_Plays_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
document.getElementById('exportPlays')?.addEventListener('click', exportPlaysCSV);



loadState();
renderPlaylists();
renderTouchCounter();
renderTimeoutsSummary();
updateClockHelper();
run();
queueAnalytics();



