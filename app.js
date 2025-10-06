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
  weReceivedKO: false, // opening kickoff flag
};

// =======================
// Utils
// =======================
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toMMSS(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

// more forgiving; returns null when invalid (so field can show error)
function fromMMSS(txt) {
  const s = String(txt || "").trim();
  if (!s) return null;
  let m, sec;
  if (s.includes(":")) {
    const parts = s.split(":");
    if (parts.length !== 2) return null;
    m = parseInt(parts[0], 10);
    sec = parseInt(parts[1], 10);
    if (Number.isNaN(m) || Number.isNaN(sec)) return null;
    if (sec < 0 || sec > 59 || m < 0) return null;
  } else {
    // Allow "1200" -> 12:00, "902" -> 9:02
    if (!/^\d{1,4}$/.test(s)) return null;
    const n = parseInt(s, 10);
    m = Math.floor(n / 100);
    sec = n % 100;
    if (sec > 59) return null;
  }
  // hard cap 12:00 (HS quarter)
  return clamp(m * 60 + sec, 0, 12 * 60);
}

function validateInt(v, def = null) {
  if (v == null) return def;
  v = String(v).trim();
  if (v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

// =======================
// Theme helpers
// =======================
function setOppChipTheme(hex) {
  const parse = (h) => {
    h = (h || "").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16),
      g = parseInt(h.slice(2, 4), 16),
      b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
  };
  const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const c = parse(hex);
  const L = lum(c);
  const bg = hex;
  const fg = L > 0.6 ? "#1a1a1a" : "#ffffff";
  const br = L > 0.6 ? "#b5b5b5" : "#303030";
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
  const usesHigh = counts[0] + counts[1]; // 8s and 7s preferred
  const fg = counts[3];
  const saf = counts[4];
  return [total, -usesHigh, fg, saf];
}

function formatCombo(counts) {
  const parts = [];
  counts.forEach((c, i) => {
    if (!c) return;
    const play = SCORING_PLAYS[i];
    parts.push(c > 1 ? `${c}× ${play.label}` : play.label);
  });
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
const elOur = $("#ourScore");
const elOpp = $("#oppScore");
const elOut = $("#output");
const elStatus = $("#status");
const viewTable = $("#view-table");
const viewRow = $("#view-row");
const elOurLabel = $("#ourLabel");
const elOppLabel = $("#oppLabel");

// Kickoff + opponent profile
const elWeReceivedKO = $("#weReceivedKO");
const elSecondHalfInfo = $("#secondHalfInfo");
const elOppName = $("#oppName");
const elOppColor = $("#oppColor");

// Bottom sticky bar
const elBottomBar = $("#bottomBar");

// =======================
// Render helpers
// =======================
function renderRow(list) {
  for (const { txt } of list) {
    const p = document.createElement("p");
    p.className = "row-line";
    p.textContent = txt;
    elOut && elOut.appendChild(p);
  }
}
function renderTable(list) {
  const table = document.createElement("table");
  table.className = "combo-table";
  table.innerHTML = `<thead><tr><th>Combo</th><th>Plays</th></tr></thead><tbody></tbody>`;
  const tb = table.querySelector("tbody");
  list.forEach(({ txt, plays }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${txt}</td><td class="td-num">${plays}</td>`;
    tb.appendChild(tr);
  });
  elOut && elOut.appendChild(table);
}

function renderBanner(our, opp, oppName) {
  const banner = document.createElement("div");
  banner.id = "banner";
  const us = document.createElement("div");
  const them = document.createElement("div");
  us.className = "badge-row";
  them.className = "badge-row";

  us.innerHTML = `<span class="pill"><strong>${TEAM_NAME}</strong> ${our}</span>`;
  them.innerHTML = `<span class="pill opp"><strong>${oppName || "Opponent"}</strong> ${opp}</span>`;
  banner.appendChild(us);
  banner.appendChild(them);
  elOut && elOut.appendChild(banner);
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
const elHalf1 = $("#half1");
const elHalf2 = $("#half2");
const elTimeInput = $("#timeInput");
const elMiniBtns = $$(".mini");

const elBallUs = $("#ballUs");
const elPTime = $("#ptime");
const elPClk = $("#pclk");
const elSnaps = $("#snaps");
const elClockResult = $("#clockResult");

function getTimeSecs() {
  return validateInt(localStorage.getItem("ccs-time-secs"), 12 * 60);
}
function setTimeSecs(s) {
  localStorage.setItem("ccs-time-secs", String(clamp(s, 0, 12 * 60)));
  if (elTimeInput) elTimeInput.value = toMMSS(getTimeSecs());
}

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
const elUseOurTO = $("#useOurTO");
const elUseOppTO = $("#useOppTO");

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

function getGroupEl(key) {
  return document.querySelector(`.to-card[data-key="${key}"] .to-checks`);
}
function getTOLeft(side, isH2) {
  const g = getGroupEl(`${side}-${isH2 ? "h2" : "h1"}`);
  if (!g) return 3;
  return [...g.querySelectorAll('input[type="checkbox"]')].filter((x) => x.checked).length;
}
function updateClockHelper() {
  const isH2 = elHalf2 && elHalf2.checked;
  const secs = getTimeSecs();
  const usTO = getTOLeft("our", isH2);
  const themTO = getTOLeft("opp", isH2);
  const haveBall = elBallUs && elBallUs.checked;

  const ptime = Math.max(0, validateInt(elPTime && elPTime.value, 6));
  const pclk = Math.max(0, validateInt(elPClk && elPClk.value, 30));
  const snaps = Math.max(0, validateInt(elSnaps && elSnaps.value, 4));

  const est = snaps * Math.max(ptime, pclk);
  const summary = `Clock ${toMMSS(secs)} • ${haveBall ? "Us" : "Them"} ball • TOs: Us ${usTO}, Them ${themTO} • Est. time used: ${toMMSS(est)}`;
  if (elClockResult) elClockResult.textContent = summary;

  // Update small TO counts under the score cards
  const ourSpan = $("#ourTOLeft");
  const oppSpan = $("#oppTOLeft");
  if (ourSpan) ourSpan.textContent = String(usTO);
  if (oppSpan) oppSpan.textContent = String(themTO);

  // Update bottom sticky bar
  if (elBottomBar) {
    elBottomBar.textContent = `${isH2 ? "2nd Half" : "1st Half"} • Time left ${toMMSS(secs)} • ${haveBall ? "Us" : "Them"} ball • TOs Us ${usTO} / Them ${themTO}`;
  }
}

// =======================
// State save/load
// =======================
function saveState() {
  const st = {
    oppName: STATE.oppName,
    oppColor: STATE.oppColor,
    collapsedTO: STATE.collapsedTO,
    weReceivedKO: STATE.weReceivedKO,
    time: getTimeSecs(),
    scores: { our: elOur && elOur.value, opp: elOpp && elOpp.value },
    to: ["our-h1", "opp-h1", "our-h2", "opp-h2"].map((key) => ({
      key,
      boxes: [...(getGroupEl(key)?.querySelectorAll('input[type="checkbox"]') || [])].map((b) => b.checked),
    })),
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(st));
}
function loadState() {
  try {
    const st = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    STATE.oppName = st.oppName || STATE.oppName;
    STATE.oppColor = st.oppColor || STATE.oppColor;
    STATE.collapsedTO = st.collapsedTO || {};
    STATE.weReceivedKO = !!st.weReceivedKO;

    if (elOur && st.scores?.our != null) elOur.value = String(validateInt(st.scores.our, 0));
    if (elOpp && st.scores?.opp != null) elOpp.value = String(validateInt(st.scores.opp, 0));
    if (typeof st.time === "number") setTimeSecs(st.time);

    (st.to || []).forEach(({ key, boxes }) => {
      const g = getGroupEl(key);
      if (!g) return;
      const cbs = [...g.querySelectorAll('input[type="checkbox"]')];
      for (let i = 0; i < Math.min(cbs.length, boxes.length); i++) cbs[i].checked = !!boxes[i];
    });
  } catch (_) {}
}

// =======================
// Opponent profile + kickoff
// =======================
function applyOpponentProfile(skipInputWrite = false) {
  if (!skipInputWrite && elOppName) elOppName.value = STATE.oppName;
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
  applyOpponentProfile(true);
  saveState();
  run();
});
elOppColor && elOppColor.addEventListener("input", () => {
  STATE.oppColor = elOppColor.value || "#9a9a9a";
  applyOpponentProfile();
  saveState();
});
elWeReceivedKO && elWeReceivedKO.addEventListener("change", () => {
  STATE.weReceivedKO = !!elWeReceivedKO.checked;
  updateSecondHalfInfo();
  saveState();
});

// Keep manual TO checkbox changes synced
$$('.to-checks input[type="checkbox"]').forEach((cb) => {
  cb.addEventListener("change", () => {
    saveState();
    updateClockHelper();
  });
});

// =======================
// Run combos (both teams)
// =======================
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

  // Build sections for both teams
  const usDiff = Math.max(0, opp - our);
  renderSection("Us: to tie", buildItems(usDiff, MAX_RESULTS));
  renderSection("Us: to lead", buildItems(usDiff + 1, MAX_RESULTS));

  const oppName = STATE.oppName || "Opponent";
  const theirDiff = Math.max(0, our - opp);
  renderSection(`${oppName}: to tie`, buildItems(theirDiff, MAX_RESULTS));
  renderSection(`${oppName}: to lead`, buildItems(theirDiff + 1, MAX_RESULTS));
}

// =======================
// Reset, listeners, big pads
// =======================
const elReset = $("#resetGame");
elReset && elReset.addEventListener("click", () => {
  if (elOur) elOur.value = "0";
  if (elOpp) elOpp.value = "0";
  if (elHalf1 && elHalf2) elHalf1.checked = true;
  setTimeSecs(12 * 60);
  ["our-h1", "opp-h1", "our-h2", "opp-h2"].forEach((k) => setTOState(k, [true, true, true]));
  STATE.collapsedTO = {};
  document.querySelectorAll(".to-card.collapsed").forEach((c) => c.classList.remove("collapsed"));
  // kickoff default
  if (elWeReceivedKO) elWeReceivedKO.checked = false;
  STATE.weReceivedKO = false;
  updateSecondHalfInfo();
  saveState();
  updateClockHelper();
  run();
});

$$(".to-card .to-title").forEach((t) => {
  t.addEventListener("click", () => {
    const card = t.closest(".to-card");
    card.classList.toggle("collapsed");
    const key = card.getAttribute("data-key");
    STATE.collapsedTO[key] = card.classList.contains("collapsed");
    saveState();
  });
});

function setTOState(key, arr) {
  const g = getGroupEl(key);
  if (!g) return;
  const cbs = [...g.querySelectorAll('input[type="checkbox"]')];
  for (let i = 0; i < Math.min(cbs.length, arr.length); i++) cbs[i].checked = !!arr[i];
}

// Press-and-hold helper for pads
function addRepeatPress(el, handler) {
  let timer = null;
  const start = () => {
    handler();
    timer = setInterval(handler, 180);
  };
  const stop = () => {
    if (timer) { clearInterval(timer); timer = null; }
  };
  el.addEventListener("mousedown", start);
  el.addEventListener("touchstart", start, { passive: true });
  ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((ev) =>
    el.addEventListener(ev, stop)
  );
}

// score buttons (chips & pads)
$$(".chip[data-delta], .pad[data-delta]").forEach((btn) => {
  const doDelta = () => {
    const delta = parseInt(btn.getAttribute("data-delta"), 10) || 0;
    const team = btn.getAttribute("data-team");
    const input = team === "our" ? elOur : elOpp;
    if (!input) return;
    input.value = String(Math.max(0, (validateInt(input.value, 0) || 0) + delta));
    saveState();
    run();
  };
  btn.addEventListener("click", doDelta);
  addRepeatPress(btn, doDelta);
});

// time micro buttons
elMiniBtns.forEach((b) => {
  b.addEventListener("click", () => {
    const d = parseInt(b.getAttribute("data-delta"), 10) || 0;
    setTimeSecs(getTimeSecs() + d);
    saveState();
    updateClockHelper();
  });
});

// Initial boot
loadState();
applyOpponentProfile();
updateSecondHalfInfo();
updateClockHelper();
run();
