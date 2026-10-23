// ==========================================================================
// Web Sous-Chef — multiple named timers.
// Timers store their end time, so they survive page changes and reloads.
// ==========================================================================
const STORE = "souschef_timers";
const listeners = new Set();
let timers = load();
let ticker = null;
let alarm = null;
let unlocked = false;

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(timers)); } catch { /* storage full or blocked */ }
}
function emit() {
  listeners.forEach(fn => fn(list()));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Browsers only play sound after a tap; call this from any click that starts a timer.
export function unlockSound() {
  if (unlocked) return;
  alarm = new Audio("src/sounds/timer-done.mp3");
  alarm.loop = true;
  alarm.volume = 1;
  alarm.play().then(() => { alarm.pause(); alarm.currentTime = 0; unlocked = true; }).catch(() => {});
}

function ringing() {
  return timers.some(t => t.state === "done");
}

function syncAlarm() {
  if (!alarm) return;
  if (ringing()) {
    if (alarm.paused) alarm.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate([300, 200, 300]);
  } else if (!alarm.paused) {
    alarm.pause();
    alarm.currentTime = 0;
  }
}

function tick() {
  const now = Date.now();
  let changed = false;
  for (const t of timers) {
    if (t.state === "running" && now >= t.endAt) {
      t.state = "done";
      t.doneAt = t.endAt;
      changed = true;
    }
  }
  if (changed) { save(); syncAlarm(); }
  emit();
  if (!timers.some(t => t.state === "running" || t.state === "done")) {
    clearInterval(ticker);
    ticker = null;
  }
}

function ensureTicker() {
  if (!ticker) ticker = setInterval(tick, 250);
  tick();
}

/** Remaining seconds (running/paused) or overtime seconds (done, as a negative number). */
export function remaining(t, now = Date.now()) {
  if (t.state === "running") return Math.max(0, (t.endAt - now) / 1000);
  if (t.state === "paused") return t.remaining;
  if (t.state === "done") return -((now - t.doneAt) / 1000);
  return t.total;
}

export function list() {
  const order = { done: 0, running: 1, paused: 2 };
  return [...timers].sort((a, b) => order[a.state] - order[b.state] || a.created - b.created);
}

export function add(name, seconds, source = null) {
  unlockSound();
  const t = {
    id: Math.random().toString(36).slice(2, 9),
    name: name || "Timer",
    total: Math.round(seconds),
    endAt: Date.now() + seconds * 1000,
    remaining: seconds,
    state: "running",
    source,
    created: Date.now(),
  };
  timers.push(t);
  save();
  ensureTicker();
  return t.id;
}

function find(id) { return timers.find(t => t.id === id); }

export function pause(id) {
  const t = find(id);
  if (!t || t.state !== "running") return;
  t.remaining = Math.max(0, (t.endAt - Date.now()) / 1000);
  t.state = "paused";
  save(); emit();
}

export function resume(id) {
  unlockSound();
  const t = find(id);
  if (!t || t.state !== "paused") return;
  t.endAt = Date.now() + t.remaining * 1000;
  t.state = "running";
  save(); ensureTicker();
}

export function addTime(id, seconds) {
  const t = find(id);
  if (!t) return;
  if (t.state === "running") t.endAt += seconds * 1000;
  else if (t.state === "paused") t.remaining += seconds;
  else if (t.state === "done") { t.endAt = Date.now() + seconds * 1000; t.state = "running"; }
  t.total += seconds;
  save(); syncAlarm(); ensureTicker();
}

export function repeat(id) {
  unlockSound();
  const t = find(id);
  if (!t) return;
  t.endAt = Date.now() + t.total * 1000;
  t.state = "running";
  delete t.doneAt;
  save(); syncAlarm(); ensureTicker();
}

export function remove(id) {
  timers = timers.filter(t => t.id !== id);
  save(); syncAlarm(); emit();
}

/** Find a running/paused timer started from a recipe step. */
export function bySource(source) {
  return timers.find(t => t.source === source) || null;
}

// Resume ticking for timers restored from a previous visit.
if (timers.some(t => t.state === "running" || t.state === "done")) ensureTicker();
