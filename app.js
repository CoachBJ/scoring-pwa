/* ===============================
   CCS Game Manager — app.js (full)
   =============================== */

/* ---------- Config ---------- */
const APP_STORAGE_KEY = "ccs-game-state-v1";
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
  return clamp(mm * 60 + ss, 0, 12 * 60); // cap at 12:00
}

/* ---------- Collapsible helpers ---------- */
function setDetailsOpen(id, open) {
  const el = document.getElementById(id);
  if (el) el.open = !!open;
}
function getDetailsOpen(id) {
  const el = document.getElementById(id);
  return !!(el && el.open);
}

/* ---------- State ---------- */
let STATE = {
  oppName: "Opponent",
  oppColor: "#9a9a9a",
  openingKO: null, // 'we' | 'them' | null
  officials: { headRef: "", sideJudge: "" },
  ui: { officialsCollapsed: false, clockAdvancedCollapsed: true }
};

function saveState() {
  // persist collapses
  STATE.ui.officialsCollapsed = !getDetailsOpen("officialsInputs");
  STATE.ui.clockAdvancedCollapsed = !getDetailsOpen("clockAdvanced");

  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(STATE));
}

function loadState() {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s && typeof s === "object") {
      STATE = { ...STATE, ...s };
      STATE.officials = { headRef: "", sideJudge: "", ...(s.officials || {}) };
      STATE.ui = {
        officialsCollapsed: false,
        clockAdvancedCollapsed: true,
        ...(s.ui || {})
      };
    }
  } catch (e) {
    console.warn("State load failed:", e);
  }
}

/* ---------- Timeout helpers ----------
   Expect timeout checkboxes to have:
   data-to-group="our-h1" / "our-h2" / "opp-h1" / "opp-h2"
   Checked = USED timeout. Remaining = 3 - used.
-------------------------------------- */
function timeoutsUsed(groupKey) {
  return $$(`input[type="checkbox"][data-to-group="${groupKey}"]:checked`).length;
}
function timeoutsLeft(groupKey) {
  return clamp(3 - timeoutsUsed(groupKey), 0, 3);
}
function currentHalfIsH2() {
  // If you already have a half toggle (e.g., #half2), it will be used.
  const el = $("#half2");
  return !!(el && el.checked);
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

/* ---------- Opening KO → 2nd-half info ---------- */
function refreshSecondHalfInfo() {
  const info = $("#secondHalfInfo");
  if (!info) return;
  if (STATE.openingKO === "we") {
    info.textContent = "2nd-half kickoff: Opponent";
  } else if (STATE.openingKO === "them") {
    info.textContent = "2nd-half kickoff: Charlotte Christian";
  } else {
    info.textContent = "2nd-half kickoff: —";
  }
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

/* ---------- Clock input ---------- */
function getTimeSecs() {
  // Prefer a visible input like #clockInput (MM:SS); fallback to #clockDisplay text.
  const input = $("#clockInput");
  if (input && input.value) return parseMMSS(input.value);
  const disp = $("#clockDisplay");
  if (disp && disp.textContent) return parseMMSS(disp.textContent);
  return 0;
}

/* ---------- Clock helper (pure calc) ---------- */
function computeClockAdvice({
  timeLeft,
  snaps,
  playClock,
  playTime,
  ballUs,
  ourTO,
  oppTO,
  oppName
}) {
  const toMMSSsafe = (s) => toMMSS(Math.max(0, Math.floor(s || 0)));

  if (ballUs) {
    const burn = snaps * playTime + Math.max(0, snaps - oppTO) * playClock;
    const canBurn = Math.min(timeLeft, burn);
    const remain = Math.max(0, timeLeft - canBurn);
    return {
      html:
        `${TEAM_NAME} has ball. ${oppName} TOs: <b>${oppTO}</b>. ` +
        `Over <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSSsafe(canBurn)}</b>. ` +
        (remain === 0
          ? `<b>Can run out the half.</b>`
          : `~<b>${toMMSSsafe(remain)}</b> would remain.`)
    };
  } else {
    const drain = snaps * playTime + Math.max(0, snaps - ourTO) * playClock;
    const canDrain = Math.min(timeLeft, drain);
    const remain = Math.max(0, timeLeft - canDrain);
    return {
      html:
        `${oppName} has ball. ${TEAM_NAME} TOs: <b>${ourTO}</b>. ` +
        `Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSSsafe(canDrain)}</b>. ` +
        `Time left would be ≈ <b>${toMMSSsafe(remain)}</b>.`
    };
  }
}

/* ---------- Clock helper (UI wrapper) ---------- */
function updateClockHelper() {
  const elSnaps = $("#snaps");
  const elPlayClock = $("#playClock");
  const elPlayTime = $("#playTime");
  const elBallUs = $("#ballUs");
  const elBallThem = $("#ballThem");
  const elClockResult = $("#clockResult");

  if (!elSnaps || !elPlayClock || !elPlayTime || !elClockResult) return;

  const timeLeft = getTimeSecs();
  const snaps = clamp(Number(elSnaps.value || 3), 1, 4);
  const pclk = clamp(Number(elPlayClock.value || 40), 20, 45);
  const ptime = clamp(Number(elPlayTime.value || 6), 1, 15);

  const h2 = currentHalfIsH2();
  const ourTO = timeoutsLeft(h2 ? "our-h2" : "our-h1");
  const oppTO = timeoutsLeft(h2 ? "opp-h2" : "opp-h1");
  const oppName = STATE.oppName || "Opponent";

  const ballUs = elBallUs ? elBallUs.checked : !(elBallThem && elBallThem.checked);

  const advice = computeClockAdvice({
    timeLeft,
    snaps,
    playClock: pclk,
    playTime: ptime,
    ballUs,
    ourTO,
    oppTO,
    oppName
  });

  elClockResult.innerHTML = advice.html;
}

/* ---------- Opponent name sync (if present) ---------- */
function wireOpponentName() {
  const nameIn = $("#oppName");
  const nameLabel = $("#ballThemName");
  if (!nameIn) return;

  const set = () => {
    STATE.oppName = nameIn.value || "Opponent";
    if (nameLabel) nameLabel.textContent = STATE.oppName;
    saveState();
    updateClockHelper();
  };

  nameIn.addEventListener("input", set);
  // restore
  if (STATE.oppName) {
    nameIn.value = STATE.oppName;
    if (nameLabel) nameLabel.textContent = STATE.oppName;
  }
}

/* ---------- Opening KO checkbox ---------- */
function wireOpeningKO() {
  const we = $("#weReceivedKO");
  if (!we) return;

  // restore
  if (STATE.openingKO === "we") we.checked = true;

  we.addEventListener("change", () => {
    STATE.openingKO = we.checked ? "we" : "them";
    saveState();
    refreshSecondHalfInfo();
  });
}

/* ---------- Officials inputs ---------- */
function wireOfficials() {
  const headRef = $("#headRef");
  const sideJudge = $("#sideJudge");
  const editBtn = $("#editOfficials");
  const clearBtn = $("#clearOfficials");

  // restore
  if (headRef) headRef.value = STATE.officials.headRef || "";
  if (sideJudge) sideJudge.value = STATE.officials.sideJudge || "";
  setDetailsOpen("officialsInputs", !STATE.ui.officialsCollapsed);

  const onChange = () => {
    STATE.officials.headRef = headRef ? headRef.value.trim() : "";
    STATE.officials.sideJudge = sideJudge ? sideJudge.value.trim() : "";
    renderOfficials();

    // auto-collapse when both filled
    const both = !!(STATE.officials.headRef && STATE.officials.sideJudge);
    setDetailsOpen("officialsInputs", !both);
    STATE.ui.officialsCollapsed = both;
    saveState();
  };

  if (headRef) headRef.addEventListener("input", onChange);
  if (sideJudge) sideJudge.addEventListener("input", onChange);

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      setDetailsOpen("officialsInputs", true);
      STATE.ui.officialsCollapsed = false;
      saveState();
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (headRef) headRef.value = "";
      if (sideJudge) sideJudge.value = "";
      STATE.officials = { headRef: "", sideJudge: "" };
      renderOfficials();
      setDetailsOpen("officialsInputs", true);
      STATE.ui.officialsCollapsed = false;
      saveState();
    });
  }

  renderOfficials();
}

/* ---------- Clock Advanced collapse (restore) ---------- */
function restoreClockAdvancedCollapse() {
  setDetailsOpen("clockAdvanced", !STATE.ui.clockAdvancedCollapsed);
}

/* ---------- Wire inputs that affect the clock helper ---------- */
function wireClockInputs() {
  ["snaps", "playClock", "playTime", "ballUs", "ballThem", "clockInput", "half2"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === "INPUT" && el.type === "text" ? "input" : "change";
    el.addEventListener(evt, () => {
      updateTOLeftDisplays();
      updateClockHelper();
      saveState();
    });
  });

  // Also watch TO checkboxes
  $$('input[type="checkbox"][data-to-group]').forEach((cb) => {
    cb.addEventListener("change", () => {
      updateTOLeftDisplays();
      updateClockHelper();
      saveState();
    });
  });
}

/* ---------- Init ---------- */
function init() {
  loadState();

  // Restore collapses (before wiring)
  restoreClockAdvancedCollapse();
  setDetailsOpen("officialsInputs", !STATE.ui.officialsCollapsed);

  wireOpponentName();
  wireOpeningKO();
  wireOfficials();
  wireClockInputs();

  refreshSecondHalfInfo();
  updateTOLeftDisplays();
  updateClockHelper();

  // Save once on boot to ensure current UI state is persisted
  saveState();
}

document.addEventListener("DOMContentLoaded", init);
