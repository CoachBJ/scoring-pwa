/* ===============================
   CCS Game Manager — app.js
   =============================== */

const APP_STORAGE_KEY = "ccs-game-state-v2";
const TEAM_NAME = "Charlotte Christian";

/* ---------- Utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v || 0));
function toMMSS(secs) {
  const s = Math.max(0, Math.floor(secs || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
function parseMMSS(str) {
  if (!str) return 0;
  const m = String(str).trim().match(/^(\d+):(\d{1,2})$/);
  if (!m) return 0;
  const mm = parseInt(m[1], 10);
  const ss = parseInt(m[2], 10);
  return clamp(mm * 60 + ss, 0, 12 * 60);
}

/* ---------- Collapsibles ---------- */
function setDetailsOpen(id, open) { const el = document.getElementById(id); if (el) el.open = !!open; }
function getDetailsOpen(id) { const el = document.getElementById(id); return !!(el && el.open); }

/* ---------- State ---------- */
let STATE = {
  oppName: "Opponent",
  oppColor: "#9a9a9a",
  openingKO: null, // 'we' | 'opp' | null
  officials: { headRef: "", sideJudge: "" },
  ui: { officialsCollapsed: false, clockAdvancedCollapsed: true },
  ballUs: true // who has the ball (always-visible control)
};

function saveState() {
  STATE.ui.officialsCollapsed = !getDetailsOpen("officialsInputs");
  STATE.ui.clockAdvancedCollapsed = !getDetailsOpen("clockAdvanced");
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(STATE));
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) || "null");
    if (!s) return;
    STATE = {
      ...STATE,
      ...s,
      officials: { headRef: "", sideJudge: "", ...(s.officials || {}) },
      ui: { officialsCollapsed: false, clockAdvancedCollapsed: true, ...(s.ui || {}) },
    };
  } catch {}
}

/* ---------- Time / Half ---------- */
function currentHalfIsH2() { const el = $("#half2"); return !!(el && el.checked); }
function getTimeSecs() {
  const input = $("#timeInput"); // fixed id
  if (input && input.value) return parseMMSS(input.value);
  return 0;
}

/* ---------- Timeouts ----------
   UI uses: checked = AVAILABLE (green).
   We count "checked" as "left".
---------------------------------*/
function attachTOGroupData() {
  // Add data-to-group to each checkbox so helpers can query uniformly.
  const groups = [
    ["group-our-h1", "our-h1"],
    ["group-opp-h1", "opp-h1"],
    ["group-our-h2", "our-h2"],
    ["group-opp-h2", "opp-h2"],
  ];
  groups.forEach(([containerId, key]) => {
    const boxWrap = document.getElementById(containerId);
    if (!boxWrap) return;
    $$("input[type=checkbox]", boxWrap).forEach(cb => cb.setAttribute("data-to-group", key));
  });
}
function timeoutsLeft(groupKey) {
  return $$(`input[type="checkbox"][data-to-group="${groupKey}"]:checked`).length;
}
function updateTOLeftDisplays() {
  const h2 = currentHalfIsH2();
  const our = timeoutsLeft(h2 ? "our-h2" : "our-h1");
  const opp = timeoutsLeft(h2 ? "opp-h2" : "opp-h1");
  const ourSpan = $("#ourTOLeft");
  const oppSpan = $("#oppTOLeft");
  if (ourSpan) ourSpan.textContent = our;
  if (oppSpan) oppSpan.textContent = opp;
}
function useTimeout(side) {
  // side: 'our' | 'opp'; take one AVAILABLE in current half (uncheck one box)
  const key = side === "our"
    ? (currentHalfIsH2() ? "our-h2" : "our-h1")
    : (currentHalfIsH2() ? "opp-h2" : "opp-h1");
  const boxes = $$(`input[type="checkbox"][data-to-group="${key}"]`);
  // checked = available → uncheck the LAST available to mark it used
  const avail = boxes.filter(b => b.checked);
  if (avail.length) avail[avail.length - 1].checked = false;
  updateTOLeftDisplays();
  updateClockHelper();
  saveState();
}

/* ---------- Opening KO → 2nd-half info ---------- */
function refreshSecondHalfInfo() {
  const info = $("#secondHalfInfo");
  if (!info) return;
  if (STATE.openingKO === "we") info.textContent = "2nd-half kickoff: Opponent";
  else if (STATE.openingKO === "opp") info.textContent = "2nd-half kickoff: Charlotte Christian";
  else info.textContent = "2nd-half kickoff: —";
}

/* ---------- Officials ---------- */
function renderOfficials() {
  const d = $("#officialsDisplay");
  const hdr = $("#headRefDisplay");
  const sdr = $("#sideJudgeDisplay");
  if (!d || !hdr || !sdr) return;
  const hasAny = !!(STATE.officials.headRef || STATE.officials.sideJudge);
  d.style.display = hasAny ? "block" : "none";
  hdr.textContent = STATE.officials.headRef ? `Head Ref: ${STATE.officials.headRef}` : "";
  sdr.textContent = STATE.officials.sideJudge ? `Side Judge: ${STATE.officials.sideJudge}` : "";
}
function wireOfficials() {
  const headRef = $("#headRef");
  const sideJudge = $("#sideJudge");
  const editBtn = $("#editOfficials");
  const clearBtn = $("#clearOfficials");
  if (headRef) headRef.value = STATE.officials.headRef || "";
  if (sideJudge) sideJudge.value = STATE.officials.sideJudge || "";
  setDetailsOpen("officialsInputs", !STATE.ui.officialsCollapsed);
  const onChange = () => {
    STATE.officials.headRef = headRef ? headRef.value.trim() : "";
    STATE.officials.sideJudge = sideJudge ? sideJudge.value.trim() : "";
    renderOfficials();
    const both = !!(STATE.officials.headRef && STATE.officials.sideJudge);
    setDetailsOpen("officialsInputs", !both);
    STATE.ui.officialsCollapsed = both;
    saveState();
  };
  headRef && headRef.addEventListener("input", onChange);
  sideJudge && sideJudge.addEventListener("input", onChange);
  editBtn && editBtn.addEventListener("click", () => {
    setDetailsOpen("officialsInputs", true);
    STATE.ui.officialsCollapsed = false; saveState();
  });
  clearBtn && clearBtn.addEventListener("click", () => {
    if (headRef) headRef.value = "";
    if (sideJudge) sideJudge.value = "";
    STATE.officials = { headRef: "", sideJudge: "" };
    renderOfficials();
    setDetailsOpen("officialsInputs", true);
    STATE.ui.officialsCollapsed = false; saveState();
  });
  renderOfficials();
}

/* ---------- Opponent name & color ---------- */
function setOppColor(hex) {
  document.documentElement.style.setProperty("--opp", hex);
  // auto decide text color
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  document.documentElement.style.setProperty("--opp-text", yiq >= 128 ? "#000000" : "#ffffff");
}
function wireOpponent() {
  const nameIn = $("#oppName");
  const nameLabel = $("#ballThemName");
  const nameInline = $("#oppNameInline");
  const colorIn = $("#oppColor");
  // restore
  if (nameIn) nameIn.value = STATE.oppName;
  if (nameLabel) nameLabel.textContent = STATE.oppName;
  if (nameInline) nameInline.textContent = STATE.oppName;
  if (colorIn) colorIn.value = STATE.oppColor;
  setOppColor(STATE.oppColor);
  // events
  nameIn && nameIn.addEventListener("input", () => {
    STATE.oppName = nameIn.value || "Opponent";
    if (nameLabel) nameLabel.textContent = STATE.oppName;
    if (nameInline) nameInline.textContent = STATE.oppName;
    saveState(); updateClockHelper();
  });
  colorIn && colorIn.addEventListener("input", () => {
    STATE.oppColor = colorIn.value || "#9a9a9a";
    setOppColor(STATE.oppColor);
    saveState();
  });
}

/* ---------- Opening KO radios ---------- */
function wireOpeningKO() {
  const we = $("#weReceivedKO");
  const opp = $("#oppReceivedKO");
  // restore
  if (STATE.openingKO === "we" && we) we.checked = true;
  if (STATE.openingKO === "opp" && opp) opp.checked = true;
  const onChange = () => {
    STATE.openingKO = we && we.checked ? "we" : "opp";
    saveState(); refreshSecondHalfInfo();
  };
  we && we.addEventListener("change", onChange);
  opp && opp.addEventListener("change", onChange);
}

/* ---------- Possession (always visible) ---------- */
function wirePossession() {
  const posUs = $("#posUs");
  const posThem = $("#posThem");
  // if these radios don’t exist yet, mirror to advanced ones for safety
  const advUs = $("#ballUs"), advThem = $("#ballThem");
  const apply = () => {
    STATE.ballUs = posUs ? !!posUs.checked : (advUs ? !!advUs.checked : true);
    if (advUs && advThem) { advUs.checked = STATE.ballUs; advThem.checked = !STATE.ballUs; }
    saveState(); updateClockHelper();
  };
  // restore
  if (posUs && posThem) {
    posUs.checked = !!STATE.ballUs; posThem.checked = !STATE.ballUs;
  } else if (advUs && advThem) {
    advUs.checked = !!STATE.ballUs; advThem.checked = !STATE.ballUs;
  }
  posUs && posUs.addEventListener("change", apply);
  posThem && posThem.addEventListener("change", apply);
  advUs && advUs.addEventListener("change", apply);
  advThem && advThem.addEventListener("change", apply);
}

/* ---------- Clock Helper (core + UI) ---------- */
function computeClockAdvice({ timeLeft, snaps, playClock, playTime, ballUs, ourTO, oppTO, oppName }) {
  const toMMSSsafe = (s) => toMMSS(Math.max(0, Math.floor(s || 0)));
  if (ballUs) {
    const burn = snaps * playTime + Math.max(0, snaps - oppTO) * playClock;
    const canBurn = Math.min(timeLeft, burn);
    const remain = Math.max(0, timeLeft - canBurn);
    return {
      html: `${TEAM_NAME} has ball. ${oppName} TOs: <b>${oppTO}</b>. Over <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSSsafe(canBurn)}</b>. ` +
            (remain === 0 ? `<b>Can run out the half.</b>` : `~<b>${toMMSSsafe(remain)}</b> would remain.`)
    };
  } else {
    const drain = snaps * playTime + Math.max(0, snaps - ourTO) * playClock;
    const canDrain = Math.min(timeLeft, drain);
    const remain = Math.max(0, timeLeft - canDrain);
    return {
      html: `${STATE.oppName} has ball. ${TEAM_NAME} TOs: <b>${ourTO}</b>. Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSSsafe(canDrain)}</b>. ` +
            `Time left would be ≈ <b>${toMMSSsafe(remain)}</b>.`
    };
  }
}
function updateClockHelper() {
  const elSnaps = $("#snaps");
  const elPlayClock = $("#playClock");
  const elPlayTime = $("#playTime");
  const elClockResult = $("#clockResult");
  if (!elSnaps || !elPlayClock || !elPlayTime || !elClockResult) return;

  const timeLeft = getTimeSecs();
  const snaps = clamp(Number(elSnaps.value || 3), 1, 4);
  const pclk = clamp(Number(elPlayClock.value || 40), 20, 45);
  const ptime = clamp(Number(elPlayTime.value || 6), 1, 15);

  const h2 = currentHalfIsH2();
  const ourTO = timeoutsLeft(h2 ? "our-h2" : "our-h1");
  const oppTO = timeoutsLeft(h2 ? "opp-h2" : "opp-h1");

  const advice = computeClockAdvice({
    timeLeft,
    snaps,
    playClock: pclk,
    playTime: ptime,
    ballUs: !!STATE.ballUs,
    ourTO,
    oppTO,
    oppName: STATE.oppName || "Opponent"
  });
  elClockResult.innerHTML = advice.html;
}

/* ---------- Wiring ---------- */
function wireClockInputs() {
  ["snaps","playClock","playTime","timeInput","half2"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === "INPUT" && (el.type === "text" || el.type === "tel") ? "input" : "change";
    el.addEventListener(evt, () => { updateTOLeftDisplays(); updateClockHelper(); saveState(); });
  });
  // time adjust buttons
  $$(".mini[data-dt]").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = parseInt(btn.getAttribute("data-dt"), 10);
      const ti = $("#timeInput"); if (!ti) return;
      const s = parseMMSS(ti.value || "0:00");
      const ns = clamp(s + delta, 0, 12*60);
      ti.value = toMMSS(ns);
      updateClockHelper(); saveState();
    });
  });
  // TO grid + quick buttons
  $$('input[type="checkbox"][data-to-group]').forEach(cb => {
    cb.addEventListener("change", () => { updateTOLeftDisplays(); updateClockHelper(); saveState(); });
  });
  const btnOur = $("#useOurTO"), btnOpp = $("#useOppTO");
  btnOur && btnOur.addEventListener("click", () => useTimeout("our"));
  btnOpp && btnOpp.addEventListener("click", () => useTimeout("opp"));
}

function wireReset() {
  const btn = $("#resetGame");
  if (!btn) return;
  btn.addEventListener("click", () => {
    localStorage.removeItem(APP_STORAGE_KEY);
    location.reload();
  });
}

/* ---------- Init ---------- */
function init() {
  loadState();
  attachTOGroupData();

  // restore collapses before wiring
  setDetailsOpen("clockAdvanced", !STATE.ui.clockAdvancedCollapsed);
  setDetailsOpen("officialsInputs", !STATE.ui.officialsCollapsed);

  wireOpponent();
  wireOpeningKO();
  wireOfficials();
  wirePossession();
  wireClockInputs();
  wireReset();

  refreshSecondHalfInfo();
  updateTOLeftDisplays();
  updateClockHelper();
  saveState();
}
document.addEventListener("DOMContentLoaded", init);
