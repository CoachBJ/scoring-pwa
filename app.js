// =======================
// Charlotte Christian Game Manager (Streamlined)
// =======================

const TEAM_NAME = "Charlotte Christian";
const MAX_RESULTS = 200;

// ----- Scoring definitions -----
const SCORING_PLAYS = [
  { pts: 8, label: "TD + 2pt" },
  { pts: 7, label: "TD + PAT" },
  { pts: 6, label: "TD (no conv)" },
  { pts: 3, label: "FG" },
  { pts: 2, label: "Safety" },
];
const JOINER = " • ";

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
const elOut = document.querySelector("#output");
const elStatus=document.querySelector("#status");
const viewTable=document.querySelector("#view-table");
const viewRow  =document.querySelector("#view-row");
const elOurLabel=document.querySelector("#ourLabel");
const elOppLabel=document.querySelector("#oppLabel");

// Opponent/theme inputs
const elOppName=document.getElementById("oppName");
const elOppColor=document.getElementById("oppColor");

// ----- Banner -----
function renderBanner(our, opp, oppName){
  const el = document.getElementById("banner");
  if (!el) return; // Guard against element not being found
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
  const row=document.createElement("div");
  list.forEach((it,idx)=>{
    const wrap=document.createElement("span"); wrap.className="wrap";
    it.txt.split(JOINER).forEach(seg=>{ const span=document.createElement("span"); span.className="segment"; span.textContent=seg; wrap.appendChild(span); });
    row.appendChild(wrap);
    if(idx<list.length-1){ const sep=document.createElement("span"); sep.textContent="   |   "; sep.className="muted"; row.appendChild(sep); }
  });
  card.appendChild(row); elOut.appendChild(card);
}
// app.js

function renderTable(list){
  const card=document.createElement("div"); card.className="card";
  const table=document.createElement("table"); table.className="table";
  table.innerHTML = `<thead><tr><th>Possessions</th><th>Option</th></tr></thead>`;
  const tb=document.createElement("tbody");
  list.forEach(it=>{
    const tr=document.createElement("tr");
    const tdA=document.createElement("td"); tdA.innerHTML=`<span class="badge">${it.plays}</span>`;
    const tdB=document.createElement("td");
    // This is the line to change:
    it.txt.split(JOINER).forEach(seg=>{ const s=document.createElement("span"); s.className="play-tag"; s.textContent=seg; tdB.appendChild(s); });
    tr.appendChild(tdA); tr.appendChild(tdB); tb.appendChild(tr);
  });
  table.appendChild(tb); card.appendChild(table); elOut.appendChild(card);
}

}
function renderSection(title, resultObj){
  const header=document.createElement("h2"); header.className="section-title"; header.style.marginTop = '20px'; header.textContent = title; elOut.appendChild(header);
  if(resultObj.msg){ const card=document.createElement("div"); card.className="card"; card.innerHTML=`<span class="muted">${resultObj.msg}</span>`; elOut.appendChild(card); }
  else { (viewTable.checked?renderTable:renderRow)(resultObj.list); }
}

// ===== Game clock / TOs (checkbox groups) =====
const elHalf1=document.getElementById("half1");
const elHalf2=document.getElementById("half2");
const elTimeInput=document.getElementById("timeInput");
const elMiniBtns=document.querySelectorAll(".mini");

function getGroupEl(key){ return document.querySelector(`.to-card[data-key="${key}"] .to-checks`); }
function getTOState(key){ const g=getGroupEl(key); const boxes=g?[...g.querySelectorAll('input[type="checkbox"]')]:[]; return boxes.map(b=>b.checked); }
function setTOState(key, arr){ const g=getGroupEl(key); if(!g) return; const boxes=[...g.querySelectorAll('input[type="checkbox"]')]; boxes.forEach((b,i)=>{ b.checked=(arr && typeof arr[i]==="boolean")?arr[i]:true; }); }
function countTO(key){ return getTOState(key).filter(Boolean).length; }

function getTimeSecs(){ const s=fromMMSS(elTimeInput.value); return s==null?0:s; }
function setTimeSecs(secs){ elTimeInput.value = toMMSS(clamp(secs,0,1440)); }

elMiniBtns.forEach(b=>{
  b.addEventListener("click", ()=>{
    let secs = getTimeSecs();
    secs = clamp(secs + Number(b.dataset.dt), 0, 1440);
    setTimeSecs(secs); saveState(); updateClockHelper();
  });
});
elTimeInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ commitManualTime(); }});
elTimeInput.addEventListener("blur", commitManualTime);
function commitManualTime(){
  const secs=fromMMSS(elTimeInput.value);
  if(secs==null){ elTimeInput.classList.add("error"); return; }
  elTimeInput.classList.remove("error");
  setTimeSecs(secs); saveState(); updateClockHelper();
}

// One-tap Use TO
document.getElementById("useOurTO").addEventListener("click", ()=>{ useTO('our'); });
document.getElementById("useOppTO").addEventListener("click", ()=>{ useTO('opp'); });
function useTO(side){
  const half2 = elHalf2.checked;
  const key = `${side}-${half2?'h2':'h1'}`;
  const g = getGroupEl(key); if(!g) return;
  const boxes=[...g.querySelectorAll('input[type="checkbox"]')];
  let idx=-1; for(let j=boxes.length-1;j>=0;j--){ if(boxes[j].checked){ idx=j; break; } }
  if(idx<0){ return; }
  boxes[idx].checked = false;
  saveState(); updateClockHelper();
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

[elBallUs, elBallThem, elSnaps, elPlayClock, elPlayTime, elHalf1, elHalf2].forEach(el=>{
  el.addEventListener("change", ()=>{ saveState(); updateClockHelper(); });
  el.addEventListener("input",  ()=>{ updateClockHelper(); }); // For number inputs
});

function updateClockHelper(){
  const timeLeft=getTimeSecs();
  const snaps=clamp(Number(elSnaps.value||3),1,4);
  const pclk =clamp(Number(elPlayClock.value||40),20,45);
  const ptime=clamp(Number(elPlayTime.value||6),1,15);
  const half2=elHalf2.checked;

  const ourTO = half2 ? countTO("our-h2") : countTO("our-h1");
  const oppTO = half2 ? countTO("opp-h2") : countTO("opp-h1");
  const oppName = STATE.oppName || "Opponent";

  if(elBallUs.checked){
    const burn = snaps*ptime + Math.max(0, snaps - oppTO)*pclk;
    const canBurn = Math.min(timeLeft, burn);
    const remain = Math.max(0, timeLeft - canBurn);
    elClockResult.innerHTML =
      `${TEAM_NAME} has ball. ${oppName} TOs: <b>${oppTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSS(canBurn)}</b>. ` +
      (remain===0 ? `<b>Can run out the half.</b>` : `~<b>${toMMSS(remain)}</b> would remain.`);
  } else {
    const drain = snaps*ptime + Math.max(0, snaps - ourTO)*pclk;
    const canDrain = Math.min(timeLeft, drain);
    elClockResult.innerHTML =
      `${oppName} has ball. ${TEAM_NAME} TOs: <b>${ourTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSS(canDrain)}</b>.`;
  }
}

// ----- State -----
const STATE_KEY="ccs-gamemanager-state-v2"; // Changed key to avoid conflicts
let STATE = { oppName:"Opponent", oppColor:"#9a9a9a", collapsedTO: {} };

function saveState(){
  document.querySelectorAll('.to-card[data-key]').forEach(card => {
    STATE.collapsedTO[card.dataset.key] = card.classList.contains('collapsed');
  });
  const s={
    our:Number(elOur.value||0), opp:Number(elOpp.value||0),
    half: elHalf2.checked?2:1,
    time: getTimeSecs(),
    to: { "our-h1": getTOState("our-h1"), "opp-h1": getTOState("opp-h1"), "our-h2": getTOState("our-h2"), "opp-h2": getTOState("opp-h2") },
    oppName: STATE.oppName, oppColor: STATE.oppColor,
    collapsedTO: STATE.collapsedTO
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(STATE_KEY)||"{}");
    elOur.value = s.our || 0;
    elOpp.value = s.opp || 0;
    (s.half===2?elHalf2:elHalf1).checked=true;
    setTimeSecs(typeof s.time==="number"? s.time : 300); // Default to 5:00

    if(s.to){ Object.keys(s.to).forEach(k=> setTOState(k, s.to[k])); }
    else { ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true])); }
    
    STATE.collapsedTO = s.collapsedTO || {};
    Object.keys(STATE.collapsedTO).forEach(key => {
        const card = document.querySelector(`.to-card[data-key="${key}"]`);
        if (card && STATE.collapsedTO[key]) {
            card.classList.add('collapsed');
        }
    });

    STATE.oppName = s.oppName || "Opponent";
    STATE.oppColor = s.oppColor || "#9a9a9a";
    applyOpponentProfile();

  }catch(e){
    console.error("Failed to load state", e);
    setTimeSecs(300); // Default to 5:00
    ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true]));
  }
}

// Opponent profile
function applyOpponentProfile(){
  elOppName.value = STATE.oppName;
  elOppColor.value = STATE.oppColor;
  document.documentElement.style.setProperty('--opp', STATE.oppColor);
  elOppLabel.textContent = STATE.oppName;
  elOurLabel.textContent = TEAM_NAME;
}
elOppName.addEventListener('input', ()=>{ STATE.oppName = elOppName.value.trim() || "Opponent"; applyOpponentProfile(); saveState(); run(); });
elOppColor.addEventListener('input', ()=>{ STATE.oppColor = elOppColor.value; applyOpponentProfile(); saveState(); });


// ----- Main scoring run -----
[elOur,elOpp].forEach(el=>el.addEventListener("input", run)); // Recalculate on score change
[viewTable, viewRow].forEach(el => el.addEventListener('change', run));


function run(){
  elOut.innerHTML=""; elStatus.textContent="";

  const our=validateInt(elOur.value);
  const opp=validateInt(elOpp.value);
  if(our==null || opp==null){ elStatus.textContent="Enter both scores."; return; }

  renderBanner(our, opp, STATE.oppName);

  // Simplified logic to always be "auto"
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
     // If scores are tied, don't show the output section, the banner handles it.
     elOut.innerHTML = "";
  }
  
  saveState();
}

// ----- Init -----
document.getElementById("resetGame").addEventListener("click", ()=>{
  if (confirm('Are you sure you want to reset the entire game?')) {
    elOur.value=0; elOpp.value=0;
    elOppName.value = "Opponent";
    elOppColor.value = "#9a9a9a";
    STATE.oppName = "Opponent";
    STATE.oppColor = "#9a9a9a";
    applyOpponentProfile();
    document.getElementById("half1").checked=true;
    setTimeSecs(300); // Reset to 5:00
    ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true]));
    STATE.collapsedTO = {};
    document.querySelectorAll('.to-card.collapsed').forEach(c => c.classList.remove('collapsed'));
    saveState(); 
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

// *** FIX: Add event listeners for manual timeout checkbox changes ***
document.querySelectorAll('.to-checks input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        saveState();
        updateClockHelper();
    });
});


loadState();
updateClockHelper();
run();
