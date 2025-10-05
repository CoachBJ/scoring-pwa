// =======================
// Charlotte Christian Game Manager (checkbox TOs + manual time only)
// =======================

const TEAM_NAME = "Charlotte Christian";
const OPP_NAME  = "Fuck Rabun Gap";

// ----- Scoring definitions -----
const SCORING_PLAYS = [
  { pts: 8, label: "TD + 2pt" },
  { pts: 7, label: "TD + PAT" },
  { pts: 6, label: "TD (no conv)" },
  { pts: 3, label: "FG" },
  { pts: 2, label: "Safety" },
];
const JOINER = " • "; // separate different plays while keeping "TD + PAT" intact

// ----- Utils -----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toMMSS = (s) => { s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), ss=s%60; return `${m}:${String(ss).padStart(2,"0")}`; };
const fromMMSS = (txt) => { const m=String(txt||"").trim().match(/^(\d{1,2}):([0-5]?\d)$/); if(!m) return null; return clamp(parseInt(m[1],10)*60+parseInt(m[2],10),0,1440); };

// ----- Scoring core -----
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
const elCap = document.querySelector("#cap");
const elCalc= document.querySelector("#calc");
const elOut = document.querySelector("#output");
const elStatus=document.querySelector("#status");
const viewTable=document.querySelector("#view-table");
const viewRow  =document.querySelector("#view-row");
const whoAuto  =document.querySelector("#who-auto");
const whoUs    =document.querySelector("#who-us");
const whoOpp   =document.querySelector("#who-opp");

// ----- Banner -----
function renderBanner(our, opp){
  const el = document.getElementById("banner");
  const usBehind  = Math.max(0, opp - our);
  const oppBehind = Math.max(0, our - opp);

  let cls="neutral", title="Game is tied";
  if(our < opp){ cls="bad";  title = `${TEAM_NAME} trails by ${usBehind}`; }
  if(our > opp){ cls="good"; title = `${OPP_NAME} trails by ${oppBehind}`; }

  el.className = `banner ${cls}`;
  el.innerHTML = `
    <div class="title">${title}</div>
    <div class="sub">${TEAM_NAME} ${our} — ${OPP_NAME} ${opp} • ${TEAM_NAME} behind: ${usBehind} • ${OPP_NAME} behind: ${oppBehind}</div>
  `;
}

// ----- Renderers -----
function renderRow(list){
  const card=document.createElement("div"); card.className="card";
  const row=document.createElement("div");
  list.forEach((it,idx)=>{
    const wrap=document.createElement("span"); wrap.className="wrap";
    it.txt.split(JOINER).forEach(seg=>{ const span=document.createElement("span"); span.className="segment"; span.textContent=seg; wrap.appendChild(span); });
    row.appendChild(wrap);
    if(idx<list.length-1){ const sep=document.createElement("span"); sep.textContent="   |   "; sep.className="muted"; row.appendChild(sep); }
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
    const tdB=document.createElement("td");
    it.txt.split(JOINER).forEach(seg=>{ const s=document.createElement("span"); s.className="segment"; s.textContent=seg; tdB.appendChild(s); });
    tr.appendChild(tdA); tr.appendChild(tdB); tb.appendChild(tr);
  });
  table.appendChild(tb); card.appendChild(table); elOut.appendChild(card);
}
function renderSection(title, resultObj){
  const header=document.createElement("div"); header.className="card"; header.innerHTML=`<strong>${title}</strong>`; elOut.appendChild(header);
  if(resultObj.msg){ const card=document.createElement("div"); card.className="card"; card.innerHTML=`<span class="muted">${resultObj.msg}</span>`; elOut.appendChild(card); }
  else { (viewTable.checked?renderTable:renderRow)(resultObj.list); }
}

// ----- Game clock (manual only) + TO checkbox groups -----
const elHalf1=document.getElementById("half1");
const elHalf2=document.getElementById("half2");

const elTimeInput=document.getElementById("timeInput");
const elMiniBtns=document.querySelectorAll(".mini");

const TO_KEYS = ["our-h1","opp-h1","our-h2","opp-h2"];
function getGroupEl(key){ return document.querySelector(`.to-checks[data-key="${key}"]`) || document.getElementById(`group-${key}`); }

function getTOState(key){
  const group = getGroupEl(key);
  const boxes = group ? [...group.querySelectorAll('input[type="checkbox"]')] : [];
  return boxes.map(b=>b.checked);
}
function setTOState(key, arr){
  const group = getGroupEl(key);
  if(!group) return;
  const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
  boxes.forEach((b,i)=>{ b.checked = (arr && typeof arr[i]==="boolean") ? arr[i] : true; });
}
function countTO(key){ return getTOState(key).filter(Boolean).length; }

function getTimeSecs(){ const s=fromMMSS(elTimeInput.value); return s==null?0:s; }
function setTimeSecs(secs){ elTimeInput.value = toMMSS(clamp(secs,0,1440)); }

// ----- State -----
const STATE_KEY="ccs-game-state-v2";
function saveState(){
  const s={
    our:Number(elOur.value||0), opp:Number(elOpp.value||0),
    half: elHalf2.checked?2:1,
    time: getTimeSecs(),
    to: {
      "our-h1": getTOState("our-h1"),
      "opp-h1": getTOState("opp-h1"),
      "our-h2": getTOState("our-h2"),
      "opp-h2": getTOState("opp-h2"),
    }
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(STATE_KEY)||"{}");
    if("our" in s) elOur.value=s.our;
    if("opp" in s) elOpp.value=s.opp;
    (s.half===2?elHalf2:elHalf1).checked=true;
    setTimeSecs(typeof s.time==="number"? s.time : 1440);
    // TOs
    if(s.to){
      TO_KEYS.forEach(k=> setTOState(k, s.to[k]));
    } else {
      TO_KEYS.forEach(k=> setTOState(k, [true,true,true])); // default 3 TOs
    }
  }catch(e){
    setTimeSecs(1440);
    TO_KEYS.forEach(k=> setTOState(k, [true,true,true]));
  }
}

// Time input handlers
function commitManualTime(){
  const secs = fromMMSS(elTimeInput.value);
  if(secs==null){ elTimeInput.classList.add("error"); return; }
  elTimeInput.classList.remove("error");
  setTimeSecs(secs); saveState(); updateClockHelper();
}
elTimeInput.addEventListener("keydown", e=>{ if(e.key==="Enter") commitManualTime(); });
elTimeInput.addEventListener("blur", commitManualTime);

// Quick -10/+10 buttons
elMiniBtns.forEach(b=>{
  b.addEventListener("click", ()=>{
    let secs = getTimeSecs();
    secs = clamp(secs + Number(b.dataset.dt), 0, 1440);
    setTimeSecs(secs); saveState(); updateClockHelper();
  });
});

// TO checkbox listeners
TO_KEYS.forEach(k=>{
  const group = getGroupEl(k);
  if(group){
    group.addEventListener("change", ()=>{ saveState(); updateClockHelper(); });
  }
});

// Half change
[elHalf1,elHalf2].forEach(el=> el.addEventListener("change", ()=>{ saveState(); updateClockHelper(); }));

// Reset
document.getElementById("resetGame").addEventListener("click", ()=>{
  elOur.value=0; elOpp.value=0;
  elHalf1.checked=true;
  setTimeSecs(1440);
  TO_KEYS.forEach(k=> setTOState(k, [true,true,true]));
  saveState(); run(); updateClockHelper();
});

// ----- Clock helper model -----
const elBallUs=document.getElementById("ballUs");
const elBallThem=document.getElementById("ballThem");
const elSnaps=document.getElementById("snaps");
const elPlayClock=document.getElementById("playClock");
const elPlayTime=document.getElementById("playTime");
const elClockResult=document.getElementById("clockResult");

[elBallUs, elBallThem, elSnaps, elPlayClock, elPlayTime].forEach(el=>{
  el.addEventListener("change", ()=>{ saveState(); updateClockHelper(); });
  el.addEventListener("input",  ()=>{ updateClockHelper(); });
});

function updateClockHelper(){
  const timeLeft=getTimeSecs();
  const snaps=clamp(Number(elSnaps.value||3),1,4);
  const pclk =clamp(Number(elPlayClock.value||40),20,45);
  const ptime=clamp(Number(elPlayTime.value||6),1,15);
  const half2=elHalf2.checked;

  const ourTO = half2 ? countTO("our-h2") : countTO("our-h1");
  const oppTO = half2 ? countTO("opp-h2") : countTO("opp-h1");

  if(elBallUs.checked){
    const burn = snaps*ptime + Math.max(0, snaps - oppTO)*pclk;
    const canBurn = Math.min(timeLeft, burn);
    const remain = Math.max(0, timeLeft - canBurn);
    elClockResult.innerHTML =
      `${TEAM_NAME} has ball. Opp TOs: <b>${oppTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSS(canBurn)}</b>. ` +
      (remain===0 ? `<b>You can run out the half.</b>` : `~<b>${toMMSS(remain)}</b> would remain.`);
  } else {
    const drain = snaps*ptime + Math.max(0, snaps - ourTO)*pclk;
    const canDrain = Math.min(timeLeft, drain);
    elClockResult.innerHTML =
      `${OPP_NAME} has ball. ${TEAM_NAME} TOs: <b>${ourTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSS(canDrain)}</b>. ` +
      `Using our TOs reduces between-play bleed up to <b>${ourTO}</b> times.`;
  }
}

// ----- Scoring run -----
elCalc.addEventListener("click", run);
[elOur,elOpp].forEach(el=>el.addEventListener("keydown", e=>{ if(e.key==="Enter") run(); }));

function renderBannerAndStatus(our, opp){
  renderBanner(our, opp);
  const usBehind=Math.max(0, opp-our);
  const oppBehind=Math.max(0, our-opp);
  elStatus.textContent =
    `Score: ${TEAM_NAME} ${our} — ${OPP_NAME} ${opp} • ${TEAM_NAME} behind: ${usBehind} • ${OPP_NAME} behind: ${oppBehind}. Showing exact-point combos.`;
}

function run(){
  elOut.innerHTML=""; elStatus.textContent="";

  const our=validateInt(elOur.value.trim());
  const opp=validateInt(elOpp.value.trim());
  if(our==null || opp==null){ elStatus.textContent="Enter both scores."; return; }

  renderBannerAndStatus(our, opp);

  const cap=Math.max(1, Number(elCap.value||200));

  // Who needs points?
  let who="auto"; if(whoUs.checked) who="us"; if(whoOpp.checked) who="opp";
  let teamNeeding = who==="auto" ? (our>opp?"opp":our<opp?"us":"either") : who;

  const diff=Math.abs(our-opp);
  const tieTarget=diff;
  const leadTarget=diff+1;

  const teamLabel = teamNeeding==="us" ? `${TEAM_NAME} needs` :
                    teamNeeding==="opp"? `${OPP_NAME} needs` : `Either team needs`;

  const tieRes = buildItems(tieTarget, cap);
  const leadRes= buildItems(leadTarget, cap);

  const titlePrefix = `${teamLabel} to…`;
  renderSection(`${titlePrefix} Tie`, tieRes);
  renderSection(`${titlePrefix} Take the Lead`, leadRes);

  saveState();
}

// ----- Init -----
loadState();
updateClockHelper();
run();
