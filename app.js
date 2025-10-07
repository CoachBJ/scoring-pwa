// =======================
// Charlotte Christian Game Manager (Streamlined)
// =======================

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

    const ourTO   = half2 ? countTO("our-h2") : countTO("our-h1");
    const oppTO   = half2 ? countTO("opp-h2") : countTO("opp-h1");
    const oppName = STATE.oppName || "Opponent";

    if (elBallUs?.checked) {
      const burn    = snaps * ptime + Math.max(0, snaps - oppTO) * pclk;
      const canBurn = Math.min(timeLeft, burn);
      const remain  = Math.max(0, timeLeft - canBurn);
      elClockResult.innerHTML =
        `${TEAM_NAME} has ball. ${oppName} TOs: <b>${oppTO}</b>. ` +
        `Over <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSS(canBurn)}</b>. ` +
        (remain === 0 ? `<b>Can run out the half.</b>` : `~<b>${toMMSS(remain)}</b> would remain.`);
    } else {
      const drain    = snaps * ptime + Math.max(0, snaps - ourTO) * pclk;
      const canDrain = Math.min(timeLeft, drain);
      const remain   = Math.max(0, timeLeft - canDrain);
      elClockResult.innerHTML =
        `${oppName} has ball. ${TEAM_NAME} TOs: <b>${ourTO}</b>. ` +
        `Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSS(canDrain)}</b>. ` +
        `Time left would be ≈ <b>${toMMSS(remain)}</b>.`;
    }

    renderTimeoutsSummary(); // keep scoreboard in sync
  } catch (e) {
    // Never let the UI die—show a small notice and keep going
    console.error('updateClockHelper error:', e);
    if (elClockResult) {
      elClockResult.textContent = 'Clock helper paused due to an input error. Fix inputs or toggle half to refresh.';
    }
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

elOppName.addEventListener('input', () => {
  STATE.oppName = elOppName.value || 'Opponent';
  applyOpponentProfile();
  saveState();
  run();
});


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
  elHeadRefDisplay.textContent = hr ? `Head Ref: ${hr}` : "";
  elSideJudgeDisplay.textContent = sj ? `Side Judge (our sideline): ${sj}` : "";
  const any = !!(hr || sj);
  elOfficialsDisplay.style.display = any ? "grid" : "none";
}

// ===== Game clock / TOs (checkbox groups) =====
const elHalf1=document.getElementById("half1");
const elHalf2=document.getElementById("half2");
const elTimeInput=document.getElementById("timeInput");
const elMiniBtns = document.querySelectorAll('.mini[data-dt]');

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
const STATE_KEY="ccs-gamemanager-state-v3"; // Incremented key to avoid old state issues
let STATE = {
  oppName: "Opponent",
  oppColor: "#9a9a9a",
  collapsedTO: {},
  openingKO: null,                // "we" | "opp" | null
  officials: { headRef: "", sideJudge: "" }
};

function saveState(){
  document.querySelectorAll('.to-card[data-key]').forEach(card => {
    STATE.collapsedTO[card.dataset.key] = card.classList.contains('collapsed');
  });

  // derive openingKO from radios
  STATE.openingKO = elWeKO.checked ? "we" : (elOppKO.checked ? "opp" : null);
  // officials already in STATE via inputs

  const s={
    our:Number(elOur.value||0), opp:Number(elOpp.value||0),
    half: elHalf2.checked?2:1,
    time: getTimeSecs(),
    to: {
      "our-h1": getTOState("our-h1"),
      "opp-h1": getTOState("opp-h1"),
      "our-h2": getTOState("our-h2"),
      "opp-h2": getTOState("opp-h2")
    },
    oppName: STATE.oppName, oppColor: STATE.oppColor,
    collapsedTO: STATE.collapsedTO,
    openingKO: STATE.openingKO,
    officials: STATE.officials
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}


function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(STATE_KEY)||"{}");
    elOur.value = s.our || 0;
    elOpp.value = s.opp || 0;
    (s.half===2?elHalf2:elHalf1).checked=true;
    setTimeSecs(typeof s.time==="number"? s.time : MAX_TIME_SECS);

    if(s.to){ Object.keys(s.to).forEach(k=> setTOState(k, s.to[k])); }
    else { ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true])); }

    STATE.collapsedTO = s.collapsedTO || {};
    Object.keys(STATE.collapsedTO).forEach(key => {
      const card = document.querySelector(`.to-card[data-key="${key}"]`);
      if (card && STATE.collapsedTO[key]) card.classList.add('collapsed');
    });

    STATE.oppName = s.oppName || "Opponent";
    STATE.oppColor = s.oppColor || "#9a9a9a";
    applyOpponentProfile();

    // NEW: opening KO + officials
    STATE.openingKO = s.openingKO || null;
    elWeKO.checked  = STATE.openingKO === "we";
    elOppKO.checked = STATE.openingKO === "opp";

    STATE.officials = s.officials || { headRef: "", sideJudge: "" };
    elHeadRef.value = STATE.officials.headRef || "";
    elSideJudge.value = STATE.officials.sideJudge || "";

    updateSecondHalfInfo();
    renderOfficials();

  }catch(e){
    console.error("Failed to load state", e);
    setTimeSecs(MAX_TIME_SECS);
    ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true]));
  }
}



// Opening KO radios
[elWeKO, elOppKO].forEach(r=>{
  r.addEventListener("change", ()=>{
    STATE.openingKO = elWeKO.checked ? "we" : (elOppKO.checked ? "opp" : null);
    updateSecondHalfInfo();
    saveState();
  });
});

// Officials text boxes (autosave + live display)
[elHeadRef, elSideJudge].forEach(inp=>{
  inp.addEventListener("input", ()=>{
    STATE.officials.headRef  = elHeadRef.value.trim();
    STATE.officials.sideJudge = elSideJudge.value.trim();
    renderOfficials();
    saveState();
  });
});


elOppName.addEventListener('input', ()=>{
    STATE.oppName = elOppName.value || "Opponent";
    applyOpponentProfile();
    saveState();
    run();
});
elOppColor.addEventListener('input', ()=>{
    STATE.oppColor = elOppColor.value;
    applyOpponentProfile();
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

  saveState();
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

    // Single tap / mouse click
    const fire = () => { useTO(side); if (navigator.vibrate) navigator.vibrate(20); };
    btn.addEventListener('click', fire);

    // Prevent iOS callout on long-press
    btn.addEventListener('contextmenu', (e) => e.preventDefault());

    // Long-press (pointer)
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

    // Keyboard accessibility
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
    });
  };

  hook('useOurTO', 'our');
  hook('useOppTO', 'opp');
})();





loadState();
renderTimeoutsSummary();   // NEW
updateClockHelper();
run();




