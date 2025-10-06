// =======================
// Charlotte Christian — Game Manager (app.js)
// =======================

const TEAM_NAME = "Charlotte Christian";
const MAX_RESULTS = 200;
const STATE_KEY = "ccs-gamemanager-state-v3";

// ----- Scoring definitions -----
const SCORING_PLAYS = [
  { pts: 8, label: "TD + 2pt" },
  { pts: 7, label: "TD + PAT" },
  { pts: 6, label: "TD (no conv)" },
  { pts: 3, label: "FG" },
  { pts: 2, label: "Safety" },
];
const JOINER = " • ";

// ----- Global STATE -----
let STATE = {
  oppName: "Opponent",
  oppColor: "#9a9a9a",
  collapsedTO: {},
  weReceivedKO: false, // NEW: opening kickoff flag
};

// =======================
// Utils
// =======================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function toMMSS(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function fromMMSS(txt) {
  const m = String(txt || "").trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return 0;
  // hard cap 12:00 (HS quarter)
  return clamp(parseInt(m[1], 10) * 60 + parseInt(m[2], 10), 0, 12 * 60);
}

function validateInt(v) {
  if (v === "" || v == null) return null;
  const n = Math.floor(Number(v));
  return Number.isNaN(n) ? null : n;
}

// Readable opponent-chip theme helpers (Color Lock)
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return { r: 154, g: 154, b: 154 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function mixHex(a, b, weight) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const w = Math.min(1, Math.max(0, weight));
  const r = Math.round(A.r * (1 - w) + B.r * w);
  const g = Math.round(A.g * (1 - w) + B.g * w);
  const b2 = Math.round(A.b * (1 - w) + B.b * w);
  return rgbToHex(r, g, b2);
}
function relLum({ r, g, b }) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastText(bgHex) {
  return relLum(hexToRgb(bgHex)) > 0.55 ? "#000" : "#fff";
}
function setOppChipTheme(baseHex) {
  const L = relLum(hexToRgb(baseHex || "#9a9a9a"));
  // If dark, lighten a lot; if light, darken some
  const bg = L < 0.45 ? mixHex(baseHex, "#ffffff", 0.72) : mixHex(baseHex, "#000000", 0.25);
  const fg = contrastText(bg);
  const br = mixHex(bg, "#000000", 0.20);

  const root = document.documentElement.style;
  root.setProperty("--opp-chip-bg", bg);
  root.setProperty("--opp-chip-fg", fg);
  root.setProperty("--opp-chip-border", br);
}

// =======================
// Scoring core
// =======================
function scoreCombos(target) {
  const combos = [];
  const counts = new Array(SCORING_PLAYS.length).fill(0);
  function dfs(rem, start) {
    if (rem === 0) {
      combos.push([...counts]);
      return;
    }
    for (let i = start; i < SCORING_PLAYS.length; i++) {
      const p = SCORING_PLAYS[i].pts;
      if (p > rem) continue;
      counts[i]++;
      dfs(rem - p, i);
      counts[i]--;
    }
  }
  if (target > 0) dfs(target, 0);
  return combos;
}

function rankKey(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  // Prefer fewer total plays, then prefer big plays
  return [total, -counts[0], -counts[1], -counts[2], counts[3], counts[4]];
}

function formatCombo(counts) {
  const parts = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] <= 0) continue;
    parts.push(counts[i] > 1 ? `${counts[i]}× ${SCORING_PLAYS[i].label}` : SCORING_PLAYS[i].label);
  }
  return parts.join(JOINER);
}

function buildItems(target, cap) {
  if (target <= 0) return { msg: target === 0 ? "Already tied." : "No points needed." };
  const combos = scoreCombos(target);
  if (!combos.length) return { msg: "Not reachable with standard scoring." };
  const items = combos
    .map((cs) => ({ cs, key: rankKey(cs), txt: formatCombo(cs), plays: cs.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) {
        if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
      }
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

// =======================
// DOM refs
// =======================
const elOur = document.querySelector("#ourScore");
const elOpp = document.querySelector("#oppScore");
const elOut = document.querySelector("#output");
const elStatus = document.querySelector("#status");
const viewTable = document.querySelector("#view-table");
const viewRow = document.querySelector("#view-row");
const elOurLabel = document.querySelector("#ourLabel");
const elOppLabel = document.querySelector("#oppLabel");

// Opponent/theme inputs
const elOppName = document.getElementById("oppName");
const elOppColor = document.getElementById("oppColor");

// Kickoff + info (NEW)
const elWeReceivedKO = document.getElementById("weReceivedKO");
const elSecondHalfInfo = document.getElementById("secondHalfInfo");

// Timeouts-left under score cards (NEW)
const elOurTOLeft = document.getElementById("ourTOLeft");
const elOppTOLeft = document.getElementById("oppTOLeft");

// Banner
function renderBanner(our, opp, oppName) {
  const el = document.getElementById("banner");
  if (!el) return;
  el.innerHTML = `
    <div class="badge-row">
      <span class="pill">${TEAM_NAME}: <b>${our ?? 0}</b></span>
      <span class="pill opp">${oppName || "Opponent"}: <b>${opp ?? 0}</b></span>
    </div>
  `;
}

// Output rendering
function renderRow(list) {
  const card = document.createElement("div");
  card.className = "card";
  const row = document.createElement("div");
  row.className = "row-opts";
  list.forEach((it, idx) => {
    it.txt.split(JOINER).forEach((seg) => {
      const span = document.createElement("span");
      span.className = "segment";
      span.textContent = seg;
      row.appendChild(span);
    });
    if (idx < list.length - 1) {
      const sep = document.createElement("span");
      sep.textContent = "|";
      sep.className = "muted";
      row.appendChild(sep);
    }
  });
  card.appendChild(row);
  elOut && elOut.appendChild(card);
}

function renderTable(list) {
  const card = document.createElement("div");
  card.className = "card";
  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `<thead><tr><th>Possessions</th><th>Option</th></tr></thead>`;
  const tb = document.createElement("tbody");
  list.forEach((it) => {
    const tr = document.createElement("tr");
    const tdA = document.createElement("td");
    tdA.innerHTML = `<span class="badge">${it.plays}</span>`;
    const tdB = document.createElement("td");
    tdB.className = "score-options-cell";
    it.txt.split(JOINER).forEach((seg) => {
      const s = document.createElement("span");
      s.className = "segment";
      s.textContent = seg;
      tdB.appendChild(s);
    });
    tr.appendChild(tdA);
    tr.appendChild(tdB);
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  card.appendChild(table);
  elOut && elOut.appendChild(card);
}

function renderSection(title, resultObj) {
  if (!elOut) return;
  const header = document.createElement("h2");
  header.className = "section-title";
  header.style.marginTop = "20px";
  header.textContent = title;
  elOut.appendChild(header);

  if (resultObj.msg) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<span class="muted">${resultObj.msg}</span>`;
    elOut.appendChild(card);
  } else {
    (viewTable && viewTable.checked ? renderTable : renderRow)(resultObj.list);
  }
}

// =======================
// Game clock / Timeouts
// =======================
const elHalf1 = document.getElementById("half1");
const elHalf2 = document.getElementById("half2");
const elTimeInput = document.getElementById("timeInput");
const elMiniBtns = document.querySelectorAll(".mini");

const elBallUs = document.getElementById("ballUs");
const elPTime = document.getElementById("ptime");
const elPClk = document.getElementById("pclk");
const elSnaps = document.getElementById("snaps");
const elClockResult = document.getElementById("clockResult");

function getTimeSecs() {
  return fromMMSS(elTimeInput ? elTimeInput.value : "0:00");
}
function setTimeSecs(secs) {
  if (elTimeInput) elTimeInput.value = toMMSS(secs);
}

function getGroupEl(key) {
  return document.querySelector(`.to-card[data-key="${key}"] .to-checks`);
}
function getTOState(key) {
  const g = getGroupEl(key);
  if (!g) return [true, true, true];
  return [...g.querySelectorAll('input[type="checkbox"]')].map((c) => !!c.checked);
}
function setTOState(key, arr) {
  const g = getGroupEl(key);
  if (!g) return;
  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  for (let i = 0; i < boxes.length && i < arr.length; i++) {
    boxes[i].checked = !!arr[i];
  }
}
function countTO(key) {
  return getTOState(key).filter(Boolean).length;
}

function updateClockHelper() {
  if (!elClockResult || !elPTime || !elPClk || !elSnaps || !elBallUs) return;

  const half2 = !!(elHalf2 && elHalf2.checked);
  const timeLeft = getTimeSecs();
  const ptime = Math.max(0, Number(elPTime.value || 0)); // play duration
  const pclk = Math.max(0, Number(elPClk.value || 0));   // clock run-off per play (when no TO)
  const snaps = Math.max(0, Math.floor(Number(elSnaps.value || 0)));

  const ourTO = half2 ? countTO("our-h2") : countTO("our-h1");
  const oppTO = half2 ? countTO("opp-h2") : countTO("opp-h1");
  const oppName = STATE.oppName || "Opponent";

  // NEW: surface TOs left under the score cards
  if (elOurTOLeft) elOurTOLeft.textContent = ourTO;
  if (elOppTOLeft) elOppTOLeft.textContent = oppTO;

  if (elBallUs.checked) {
    const burn = snaps * ptime + Math.max(0, snaps - oppTO) * pclk;
    const canBurn = Math.min(timeLeft, burn);
    const remain = Math.max(0, timeLeft - canBurn);
    elClockResult.innerHTML =
      `${TEAM_NAME} has ball. ${oppName} TOs: <b>${oppTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSS(canBurn)}</b>. ` +
      (remain === 0 ? `<b>Can run out the half.</b>` : `~<b>${toMMSS(remain)}</b> would remain.`);
  } else {
    const drain = snaps * ptime + Math.max(0, snaps - ourTO) * pclk;
    const canDrain = Math.min(timeLeft, drain);
    const remain = Math.max(0, timeLeft - canDrain);
    elClockResult.innerHTML =
      `${oppName} has ball. ${TEAM_NAME} TOs: <b>${ourTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSS(canDrain)}</b>. ` +
      `Time left would be ≈ <b>${toMMSS(remain)}</b>.`;
  }
}

// Mini time buttons
elMiniBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const delta = Number(btn.dataset.delta || 0);
    const secs = Math.max(0, getTimeSecs() + delta);
    setTimeSecs(secs);
    saveState();
    updateClockHelper();
  });
});

// Manual time commit
function commitManualTime() {
  const secs = fromMMSS(elTimeInput.value);
  if (secs == null) {
    elTimeInput && elTimeInput.classList.add("error");
    return;
  }
  elTimeInput && elTimeInput.classList.remove("error");
  setTimeSecs(secs);
  saveState();
  updateClockHelper();
}
elTimeInput && elTimeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") commitManualTime();
});
elTimeInput && elTimeInput.addEventListener("blur", commitManualTime);

// One-tap Use TO
const elUseOurTO = document.getElementById("useOurTO");
const elUseOppTO = document.getElementById("useOppTO");

function useTO(side) {
  const half2 = elHalf2 && elHalf2.checked;
  const key = `${side}-${half2 ? "h2" : "h1"}`;
  const g = getGroupEl(key);
  if (!g) return;
  const boxes = [...g.querySelectorAll('input[type="checkbox"]')];
  let idx = -1;
  for (let j = boxes.length - 1; j >= 0; j--) {
    if (boxes[j].checked) {
      idx = j;
      break;
    }
  }
  if (idx < 0) return;
  boxes[idx].checked = false;
  saveState();
  updateClockHelper();
}
elUseOurTO && elUseOurTO.addEventListener("click", () => useTO("our"));
elUseOppTO && elUseOppTO.addEventListener("click", () => useTO("opp"));

// Update calc on inputs
elBallUs && elBallUs.addEventListener("change", () => { saveState(); updateClockHelper(); });
[elPTime, elPClk, elSnaps].forEach(el => el && el.addEventListener("input", () => { saveState(); updateClockHelper(); }));
[elHalf1, elHalf2].forEach(el => el && el.addEventListener("change", () => { saveState(); updateClockHelper(); }));

// =======================
// Quick score chips
// =======================
document.querySelectorAll(".chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const team = btn.dataset.team;
    const delta = Number(btn.dataset.delta || 0);
    if (!team || !Number.isFinite(delta)) return;
    if (team === "our" && elOur) elOur.value = String((validateInt(elOur.value) || 0) + delta);
    if (team === "opp" && elOpp) elOpp.value = String((validateInt(elOpp.value) || 0) + delta);
    saveState();
    run();
  });
});

// =======================
// State (save/load)
// =======================
function saveState() {
  // store collapsed state for TO cards
  document.querySelectorAll('.to-card[data-key]').forEach((card) => {
    STATE.collapsedTO[card.dataset.key] = card.classList.contains("collapsed");
  });

  const s = {
    our: Number(elOur && elOur.value || 0),
    opp: Number(elOpp && elOpp.value || 0),
    half: elHalf2 && elHalf2.checked ? 2 : 1,
    time: getTimeSecs(),
    to: {
      "our-h1": getTOState("our-h1"),
      "opp-h1": getTOState("opp-h1"),
      "our-h2": getTOState("our-h2"),
      "opp-h2": getTOState("opp-h2"),
    },
    oppName: STATE.oppName,
    oppColor: STATE.oppColor,
    collapsedTO: STATE.collapsedTO,
    weReceivedKO: STATE.weReceivedKO, // NEW
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");

    if (elOur) elOur.value = String(s.our ?? 0);
    if (elOpp) elOpp.value = String(s.opp ?? 0);

    if (elHalf1 && elHalf2) {
      if (s.half === 2) elHalf2.checked = true;
      else elHalf1.checked = true;
    }

    setTimeSecs(Number.isFinite(s.time) ? s.time : 12*60);

    ["our-h1", "opp-h1", "our-h2", "opp-h2"].forEach((k) => setTOState(k, s.to?.[k] ?? [true, true, true]));

    STATE.oppName = s.oppName || "Opponent";
    STATE.oppColor = s.oppColor || "#9a9a9a";
    STATE.collapsedTO = s.collapsedTO || {};

    // NEW: opening kickoff
    STATE.weReceivedKO = !!s.weReceivedKO;
    if (elWeReceivedKO) elWeReceivedKO.checked = STATE.weReceivedKO;

    // apply collapses
    document.querySelectorAll('.to-card[data-key]').forEach((card) => {
      const k = card.dataset.key;
      if (STATE.collapsedTO[k]) card.classList.add("collapsed");
      else card.classList.remove("collapsed");
    });

    applyOpponentProfile();
    updateSecondHalfInfo(); // NEW
  } catch (e) {
    console.error("Failed to load state", e);
    setTimeSecs(12*60);
    ["our-h1", "opp-h1", "our-h2", "opp-h2"].forEach((k) => setTOState(k, [true, true, true]));
  }
}

// =======================
// Opponent profile + kickoff info
// =======================
function applyOpponentProfile() {
  if (elOppName) elOppName.value = STATE.oppName;
  if (elOppColor) elOppColor.value = STATE.oppColor;

  // theme vars
  document.documentElement.style.setProperty("--opp", STATE.oppColor);
  if (elOppLabel) elOppLabel.textContent = STATE.oppName;
  if (elOurLabel) elOurLabel.textContent = TEAM_NAME;

  // Color lock (chips)
  setOppChipTheme(STATE.oppColor);

  // ensure kickoff info reflects name changes
  updateSecondHalfInfo();
}

function updateSecondHalfInfo() {
  if (!elSecondHalfInfo) return;
  const oppName = STATE.oppName || "Opponent";
  const receiver = STATE.weReceivedKO ? oppName : TEAM_NAME;
  elSecondHalfInfo.textContent = `2nd-half kickoff: ${receiver}`;
}

// inputs
elOppName && elOppName.addEventListener("input", () => {
  STATE.oppName = elOppName.value || "Opponent";
  applyOpponentProfile();
  saveState();
  run();
});
elOppColor && elOppColor.addEventListener("input", () => {
  STATE.oppColor = elOppColor.value || "#9a9a9a";
  applyOpponentProfile();
  saveState();
});

// NEW: opening kickoff checkbox listener
elWeReceivedKO && elWeReceivedKO.addEventListener("change", () => {
  STATE.weReceivedKO = !!elWeReceivedKO.checked;
  saveState();
  updateSecondHalfInfo();
});

// =======================
// Main scoring run
// =======================
[elOur, elOpp].forEach((el) => el && el.addEventListener("input", run));
[viewTable, viewRow].forEach((el) => el && el.addEventListener("change", run));

function run() {
  if (!elOut) return;

  elOut.innerHTML = "";
  if (elStatus) elStatus.textContent = "";

  const our = validateInt(elOur && elOur.value);
  const opp = validateInt(elOpp && elOpp.value);

  if (our == null || opp == null) {
    if (elStatus) elStatus.textContent = "Enter both scores.";
    return;
  }

  renderBanner(our, opp, STATE.oppName);

  // Build two sections: what we need to TIE and to LEAD
  const diff = Math.max(0, opp - our);
  const toTie = buildItems(diff, MAX_RESULTS);
  renderSection("To tie", toTie);

  const toLead = buildItems(diff + 1, MAX_RESULTS);
  renderSection("To lead", toLead);
}

// =======================
// Reset, collapsible TO cards, listeners
// =======================
const elReset = document.getElementById("resetGame");
elReset && elReset.addEventListener("click", () => {
  if (elOur) elOur.value = "0";
  if (elOpp) elOpp.value = "0";
  if (elHalf1 && elHalf2) elHalf1.checked = true;
  setTimeSecs(12*60);
  ["our-h1", "opp-h1", "our-h2", "opp-h2"].forEach((k) => setTOState(k, [true, true, true]));
  STATE.collapsedTO = {};
  document.querySelectorAll(".to-card.collapsed").forEach((c) => c.classList.remove("collapsed"));
  // NEW: reset opening kickoff
  STATE.weReceivedKO = false;
  if (elWeReceivedKO) elWeReceivedKO.checked = false;
  saveState();
  run();
  updateClockHelper();
  updateSecondHalfInfo();
});

document.querySelectorAll(".to-title").forEach((title) => {
  title.addEventListener("click", () => {
    const card = title.closest('.to-card[data-key]');
    if (!card) return;
    card.classList.toggle("collapsed");
    saveState();
  });
});

// Keep manual TO checkbox changes synced
document.querySelectorAll('.to-checks input[type="checkbox"]').forEach((cb) => {
  cb.addEventListener("change", () => {
    saveState();
    updateClockHelper();
  });
});

// Initial boot
loadState();
updateClockHelper();
run();
