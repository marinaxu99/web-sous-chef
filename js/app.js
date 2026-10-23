// ==========================================================================
// Web Sous-Chef — app shell, routing and views
// ==========================================================================
import * as ai from "./ai.js";
import * as T from "./timers.js";
import { WEIGHTS, VOLUME_ML, WEIGHT_G, OVEN_PRESETS, SWAPS, SAFE_TEMPS } from "./data.js";
import {
  esc, isUrl, youtubeId, isRedNote, hostName, clock, videoLinkAt, formatAmount, parseAmount,
  convertForDisplay, ingredientStatus, avoidHits, packRecipe, unpackRecipe, uid, normalize, shortUnit,
} from "./util.js";

const view = document.getElementById("view");
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// --------------------------------------------------------------------------
// The original robot (paths copied from src/images/home_robot.svg and robot-head.svg)
// --------------------------------------------------------------------------
const ROBOT_BODY = `M141.5 22.5C141.5 24.7213 140.535 26.717 139 28.0903V37.5H164C172.285 37.5 179 44.2157 179 52.5V102.5C179 110.785 172.285 117.5 164 117.5H134H104C95.7157 117.5 89 110.785 89 102.5V52.5C89 44.2157 95.7157 37.5 104 37.5H129V28.0903C127.465 26.717 126.5 24.7213 126.5 22.5C126.5 18.3579 129.858 15 134 15C138.142 15 141.5 18.3579 141.5 22.5ZM104 47.5C101.239 47.5 99 49.7386 99 52.5V102.5C99 105.261 101.239 107.5 104 107.5H164C166.761 107.5 169 105.261 169 102.5V52.5C169 49.7386 166.761 47.5 164 47.5H104ZM84 62.5H74V92.5H84V62.5ZM184 62.5H194V92.5H184V62.5ZM119 85C123.142 85 126.5 81.642 126.5 77.5C126.5 73.358 123.142 70 119 70C114.858 70 111.5 73.358 111.5 77.5C111.5 81.642 114.858 85 119 85ZM149 85C153.142 85 156.5 81.642 156.5 77.5C156.5 73.358 153.142 70 149 70C144.858 70 141.5 73.358 141.5 77.5C141.5 81.642 144.858 85 149 85Z M109 121H99V194H109V121Z M169 121H159V194H169V121Z M112 158V170H156.5V158H112Z M182 121H172V166H182V121Z M96 121H86V127V133H66V143H96V133V121Z`;
const ROBOT_HEAD = `M45 6.66669C45 8.14752 44.3563 9.47799 43.3333 10.3935V16.6667H60C65.523 16.6667 70 21.1439 70 26.6667V60C70 65.523 65.523 70 60 70H20C14.4772 70 10 65.523 10 60V26.6667C10 21.1439 14.4772 16.6667 20 16.6667H36.6667V10.3935C35.6437 9.47799 35 8.14752 35 6.66669C35 3.90525 37.2387 1.66669 40 1.66669C42.7613 1.66669 45 3.90525 45 6.66669ZM20 23.3334C18.1591 23.3334 16.6667 24.8258 16.6667 26.6667V60C16.6667 61.841 18.1591 63.3334 20 63.3334H60C61.841 63.3334 63.3333 61.841 63.3333 60V26.6667C63.3333 24.8258 61.841 23.3334 60 23.3334H20ZM6.66667 33.3334H0V53.3334H6.66667V33.3334ZM73.3333 33.3334H80V53.3334H73.3333V33.3334ZM30 48.3334C32.7614 48.3334 35 46.0947 35 43.3334C35 40.572 32.7614 38.3334 30 38.3334C27.2386 38.3334 25 40.572 25 43.3334C25 46.0947 27.2386 48.3334 30 48.3334ZM50 48.3334C52.7613 48.3334 55 46.0947 55 43.3334C55 40.572 52.7613 38.3334 50 38.3334C47.2387 38.3334 45 40.572 45 43.3334C45 46.0947 47.2387 48.3334 50 48.3334Z`;

function robot({ type = "head", color = "#111111", label = "" } = {}) {
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`;
  if (type === "body") return `<span class="robot"><svg viewBox="62 11 136 187" ${a11y}><path d="${ROBOT_BODY}" fill="${color}"/></svg></span>`;
  return `<span class="robot"><svg viewBox="0 0 80 80" ${a11y}><path d="${ROBOT_HEAD}" fill="${color}"/></svg></span>`;
}
function paintRobots(root = document) {
  $$("[data-robot]", root).forEach(el => {
    el.innerHTML = robot({ type: el.dataset.robot, color: el.dataset.color || "#111111" });
  });
}

// Speech bubble with its tail pointing at the robot.
function bubble(text, { size = "sm", tail = "left", html = false } = {}) {
  const sw = size === "lg" ? 4 : 3;
  return `<p class="bubble bubble-${size} tail-${tail}">${html ? text : esc(text)}<svg class="tail" viewBox="0 0 24 26" aria-hidden="true"><path d="M${sw} 0 L22 13 L${sw} 26" fill="#FFFFFF" stroke="#111111" stroke-width="${sw}" stroke-linejoin="miter"/><rect x="0" y="${sw + 1}" width="${sw + 1}" height="${26 - 2 * (sw + 1)}" fill="#FFFFFF"/></svg></p>`;
}
const says = (text, opts = {}) => `<div class="robot-says">${robot()}${bubble(text, { tail: "left", ...opts })}</div>`;

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------
const STATE_KEY = "souschef_state_v3";
const SAVED_KEY = "souschef_saved";
const PREFS_KEY = "souschef_prefs";

const defaultState = () => ({
  query: { mode: "have", fridge: [], dish: "", avoid: [], pantry: true, maxMinutes: null, sources: { video: true, blog: true, classic: true } },
  searchStatus: "idle", searchError: "", searchDetail: "", searchCode: "", results: [], warnings: [], compare: [],
  item: null, recipe: null, recipeStatus: "idle", recipeError: "", recipeDetail: "", recipeErrorCode: "",
  scale: 1, cookStep: 0,
});

let S = (() => {
  try { return { ...defaultState(), ...JSON.parse(sessionStorage.getItem(STATE_KEY)) }; } catch { return defaultState(); }
})();
if (S.searchStatus === "loading") S.searchStatus = "idle";
if (S.recipeStatus === "loading") S.recipeStatus = S.recipe ? "done" : "idle";

function saveState() { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(S)); } catch { /* full */ } }

const prefs = (() => {
  try { return { units: "original", temp: "c", ...JSON.parse(localStorage.getItem(PREFS_KEY)) }; } catch { return { units: "original", temp: "c" }; }
})();
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }

function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; } }
function storeSaved(list) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch { toast("Couldn't save: browser storage is full."); } }
const recipeKey = r => (r?.source?.url ? r.source.url : `${r?.kind}:${normalize(r?.title)}`);
const isSaved = r => loadSaved().some(s => recipeKey(s.recipe) === recipeKey(r));
function updateSavedCount() {
  const n = loadSaved().length;
  $$("[data-saved-count]").forEach(el => { el.textContent = n ? ` · ${n}` : ""; });
}

// --------------------------------------------------------------------------
// Routing
// --------------------------------------------------------------------------
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(qs || "") };
}
const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };

let currentPath = null;
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch { wakeLock = null; }
}
function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && parseHash().path === "/cook") requestWakeLock();
});

async function render() {
  const { path, params } = parseHash();
  const changed = path !== currentPath;
  currentPath = path;
  document.body.classList.toggle("cooking", path === "/cook");
  if (path === "/cook") requestWakeLock(); else releaseWakeLock();

  const section = path.startsWith("/tools") ? "tools" : path === "/saved" ? "saved" : path === "/cook" ? "cook" : "search";
  $$("[data-nav]").forEach(a => (a.dataset.nav === section ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $$("[data-tab]").forEach(a => (a.dataset.tab === section ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));

  if (path === "/cook" && params.get("r")) {
    try {
      const recipe = await unpackRecipe(params.get("r"));
      S.recipe = recipe; S.item = null; S.recipeStatus = "done"; S.scale = 1;
      S.cookStep = Math.max(0, Number(params.get("s")) || 0);
      saveState();
      history.replaceState(null, "", "#/cook");
      toast("Recipe received. Yes, chef!");
    } catch {
      toast("That recipe link looks broken.");
    }
  }

  let html;
  if (path === "/") html = homeView();
  else if (path === "/results") html = resultsView();
  else if (path === "/compare") html = compareView();
  else if (path === "/recipe") html = recipeView();
  else if (path === "/cook") html = cookView();
  else if (path.startsWith("/tools")) html = toolsView(path.split("/")[2] || "timers", params);
  else if (path === "/saved") html = savedView();
  else html = `<div class="wrap"><p>That page doesn't exist. <a href="#/">Go home</a>.</p></div>`;

  view.innerHTML = html;
  afterRender(path, params);
  refreshLive();
  if (changed) {
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
}
window.addEventListener("hashchange", render);

function afterRender(path, params) {
  document.title = {
    "/": "Web Sous-Chef", "/results": "Picks · Web Sous-Chef", "/compare": "Compare · Web Sous-Chef",
    "/recipe": `${S.recipe?.title || "Recipe"} · Web Sous-Chef`, "/cook": `Cooking · ${S.recipe?.title || "Web Sous-Chef"}`,
    "/saved": "Saved · Web Sous-Chef",
  }[path] || "Kitchen tools · Web Sous-Chef";
  if (path === "/recipe" && S.recipeStatus === "done") buildQr();
  if (path.startsWith("/tools/convert")) updateConverter();
  if (path.startsWith("/tools/swaps")) { const i = $("#swap-q"); if (i && params.get("q")) i.value = params.get("q"); updateSwaps(); }
}

// --------------------------------------------------------------------------
// Shared pieces
// --------------------------------------------------------------------------
function chipsHtml(list, kind) {
  return list.map((v, i) => `<span class="chip">${esc(v)}<button type="button" data-action="chip-remove" data-kind="${kind}" data-index="${i}" aria-label="Remove ${esc(v)}">×</button></span>`).join("");
}

function entry({ id, kind, placeholder, large = false, extra = "" }) {
  const list = kind === "avoid" ? S.query.avoid : S.query.fridge;
  return `<div class="entry ${large ? "entry-lg" : ""} ${kind === "avoid" ? "is-avoid" : ""}" data-focus="${id}">
    ${chipsHtml(list, kind)}
    <input id="${id}" type="text" autocomplete="off" enterkeyhint="done" placeholder="${esc(list.length ? "Add more" : placeholder)}">
    ${extra}
  </div>`;
}

function timeSeg() {
  const v = S.query.maxMinutes || "";
  const opt = (val, label) => `<button type="button" data-action="time" data-value="${val}" aria-pressed="${String(v) === String(val)}">${label}</button>`;
  return `<div class="seg" role="group" aria-label="Cooking time">${opt("", "Any")}${opt(20, "≤ 20 min")}${opt(45, "≤ 45 min")}</div>`;
}

function toggle({ action, checked, title, desc = "", extra = "" }) {
  return `<label class="toggle"><input type="checkbox" data-action="${action}" ${extra} ${checked ? "checked" : ""}><span class="box" aria-hidden="true"></span><span><span class="toggle-title">${title}</span>${desc ? `<span class="toggle-desc">${desc}</span>` : ""}</span></label>`;
}

function errorNotice(message, detail, buttons) {
  return `<div class="notice notice-error"><p>${esc(message)}</p>
    ${detail ? `<details><summary>Details</summary><code>${esc(detail)}</code></details>` : ""}
    <div class="row-actions">${buttons}</div></div>`;
}

const kindTag = kind => `<span class="tag tag-${kind}">${{ video: "Video", blog: "Blog", classic: "Classic", paste: "Post" }[kind] || kind}</span>`;

// --------------------------------------------------------------------------
// Home
// --------------------------------------------------------------------------
function homeView() {
  const q = S.query;
  const have = q.mode === "have";
  const pasteBtn = `<button type="button" class="icon-in" data-action="open-paste" aria-label="Paste a post or screenshot" title="Paste a post or screenshot"><svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="17"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/></svg></button>`;
  return `<div class="home">
    <section class="hero">
      <div class="hero-robot">
        ${bubble("What are we cooking, chef?", { size: "lg", tail: "right" })}
        ${robot({ type: "body", label: "Sous-Chef robot" })}
      </div>
      <h1>Web Sous-Chef</h1>
      <p class="tagline">A calm, focused kitchen companion</p>
    </section>

    ${ai.getKey() ? "" : `<div class="notice notice-quiet" style="width:100%"><p><strong>First, a key.</strong> Sous-Chef searches with your own free Gemini key. Timers and tools work without it.</p><div><button type="button" class="btn btn-sm" data-open-settings>Add key</button></div></div>`}

    <form class="search-card card card-raised" id="search-form" novalidate>
      <div class="seg" role="group" aria-label="Search by">
        <button type="button" data-action="mode" data-mode="have" aria-pressed="${have}">What I have</button>
        <button type="button" data-action="mode" data-mode="dish" aria-pressed="${!have}">A dish</button>
      </div>
      <div class="group">
        <label class="label" for="q-input">${have ? "Ingredients" : "Dish"}</label>
        ${have
          ? entry({ id: "q-input", kind: "fridge", placeholder: "eggs, scallions, rice… or paste a link", large: true, extra: pasteBtn })
          : `<div class="entry entry-lg" data-focus="q-input"><input id="q-input" type="text" autocomplete="off" enterkeyhint="search" value="${esc(q.dish)}" placeholder="kimchi jjigae… or paste a link">${pasteBtn}</div>`}
      </div>
      <div class="group">
        <label class="label" for="avoid-input">Avoid</label>
        ${entry({ id: "avoid-input", kind: "avoid", placeholder: "allergies, dislikes" })}
      </div>
      <div class="search-foot">
        <div class="opts">
          <div class="group"><span class="label">Time</span>${timeSeg()}</div>
          ${toggle({ action: "pantry", checked: q.pantry, title: "Basic pantry", desc: "Salt, pepper, oil, sugar, soy sauce, water" })}
        </div>
        <button type="submit" class="btn btn-primary btn-lg">Find recipes →</button>
      </div>
    </form>

    <ol class="steps-strip">
      <li><span class="label">01 · Find</span><p>Recipes from the cooks you trust.</p></li>
      <li><span class="label">02 · Prep</span><p>Tidied into clear steps. Their amounts, untouched.</p></li>
      <li><span class="label">03 · Cook</span><p>On your phone, timers ready.</p></li>
    </ol>
  </div>
  <footer class="site-foot"><span class="label">[ Web Sous-Chef · every recipe credits its cook ]</span></footer>`;
}

// --------------------------------------------------------------------------
// Results
// --------------------------------------------------------------------------
function filtersHtml() {
  const q = S.query;
  return `<aside class="filters" aria-label="Search and filters">
    <details open>
      <summary><span class="label">Search &amp; filters</span><span aria-hidden="true">▾</span></summary>
      <div class="filter-inner">
        ${q.mode === "dish" ? `<div class="filter-group"><label class="label" for="dish-side">Dish</label><div class="entry" data-focus="dish-side"><input id="dish-side" type="text" value="${esc(q.dish)}" autocomplete="off"></div></div>` : ""}
        <div class="filter-group"><label class="label" for="fridge-side">Ingredients</label>${entry({ id: "fridge-side", kind: "fridge", placeholder: "Add an ingredient" })}</div>
        <div class="filter-group"><label class="label" for="avoid-side">Avoid</label>${entry({ id: "avoid-side", kind: "avoid", placeholder: "allergies, dislikes" })}</div>
        <div class="filter-group"><span class="label">Time</span>${timeSeg()}</div>
        <fieldset class="filter-group">
          <legend class="label">Sources</legend>
          ${toggle({ action: "source", checked: q.sources.video, title: "Videos", desc: "YouTube", extra: 'data-source="video"' })}
          ${toggle({ action: "source", checked: q.sources.blog, title: "Blogs", desc: "Recipe sites", extra: 'data-source="blog"' })}
          ${toggle({ action: "source", checked: q.sources.classic, title: "Classics", desc: "Well-known dishes", extra: 'data-source="classic"' })}
        </fieldset>
        ${toggle({ action: "pantry", checked: q.pantry, title: "Basic pantry", desc: "Salt, pepper, oil, sugar, soy sauce, water" })}
        <button type="button" class="btn btn-primary" data-action="search">${isStale() ? "Update results →" : "Search again"}</button>
      </div>
    </details>
  </aside>`;
}

function usesBar(r) {
  const total = Math.min(S.query.fridge.length, 8);
  if (!total) return "";
  const used = Math.min(r.uses.length, total);
  return `<span class="uses-bar" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < used ? "on" : ""}"></i>`).join("")}</span>`;
}

function thumbHtml(r) {
  if (r.kind === "classic") return `<div class="thumb thumb-classic">${robot()}<span>A well-known dish, written by Sous-Chef</span></div>`;
  const ph = r.kind === "video"
    ? `<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></span>`
    : `<span class="ph" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg></span>`;
  const img = r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
  const badge = r.kind === "video" && r.duration ? `<span class="badge">▶ ${clock(r.duration)}</span>` : r.kind === "blog" ? `<span class="badge">${esc(hostName(r.url))}</span>` : "";
  return `<div class="thumb">${ph}${img}${badge}</div>`;
}

function ticketTime(r) {
  if (r.minutes) return `${Math.round(r.minutes)}<small> MIN</small>`;
  if (r.duration) return `~${Math.max(1, Math.round(r.duration / 60))}<small> MIN</small>`;
  return `<small>— MIN</small>`;
}

function resultCard(r, index) {
  const picked = S.compare.includes(r.id);
  const total = Math.min(S.query.fridge.length, 8);
  const used = Math.min(r.uses.length, total);
  const haveText = !total ? "" : used >= total ? `all ${total}` : r.uses.length ? esc(r.uses.join(", ")) : "none of yours";
  const allergens = r.allergens || [];
  const notes = [];
  if (allergens.length) notes.push(`<span class="warn">⚠ Allergens: ${esc(allergens.join(", "))}</span>`);
  if (r.summary) notes.push(esc(r.summary));
  return `<article class="result ${picked ? "is-picked" : ""}">
    <div class="ticket-head"><span class="tech">No. ${String(index + 1).padStart(2, "0")} · ${{ video: "Video", blog: "Blog", classic: "Classic" }[r.kind]}</span><span class="ticket-time">${ticketTime(r)}</span></div>
    ${thumbHtml(r)}
    <div class="result-title"><h3>${esc(r.title)}</h3><span>${esc(r.kind === "classic" ? `${r.source} home style` : r.source)}</span></div>
    <dl class="facts">
      ${total ? `<dt>Have</dt><dd>${usesBar(r)}${haveText}</dd>` : ""}
      <dt>Need</dt><dd>${r.needs.length ? r.needs.slice(0, 4).map(n => `<span class="hl">${esc(n)}</span>`).join(" ") : `<span class="ok">Nothing. Ready to cook.</span>`}</dd>
      ${notes.length ? `<dt>Note</dt><dd>${notes.join("<br>")}</dd>` : ""}
    </dl>
    <div class="ticket-foot">
      ${toggle({ action: "compare", checked: picked, title: "Compare", extra: `data-id="${r.id}"` })}
      <button type="button" class="btn btn-sm" data-action="open-result" data-id="${r.id}">Open →</button>
    </div>
  </article>`;
}

function resultsView() {
  let main;
  if (S.searchStatus === "loading") {
    main = `${says("On it, chef", { html: true })}
      <p class="muted" style="margin:0">Checking YouTube, recipe blogs and the classics. About 20–40 seconds.</p>
      <div class="result-grid">${'<div class="skeleton"></div>'.repeat(3)}</div>`;
  } else if (S.searchStatus === "error") {
    main = `${says("Sorry, chef.")}
      ${errorNotice(S.searchError, S.searchDetail, `<button type="button" class="btn btn-primary btn-sm" data-action="search">Try again</button>${["NO_KEY", "BAD_KEY", "MODEL"].includes(S.searchCode) ? `<button type="button" class="btn btn-sm" data-open-settings>Keys</button>` : ""}`)}`;
  } else if (!S.results.length) {
    main = says(S.searchStatus === "done" ? "Nothing yet. Loosen a filter?" : "Add ingredients, then search.");
  } else {
    main = `${says(`${S.results.length} picks, chef. Compare up to 3.`)}
      ${S.warnings.map(w => `<div class="notice notice-quiet"><p>${esc(w.text)}</p>${w.settings ? `<div><button type="button" class="btn btn-sm" data-open-settings>Keys</button></div>` : ""}</div>`).join("")}
      <div class="result-grid">${S.results.map((r, i) => resultCard(r, i)).join("")}</div>`;
    main = `<div class="stale-banner" id="stale-banner" role="status" ${isStale() ? "" : "hidden"}>
        <p><strong>Filters changed.</strong> These picks are from your last search.</p>
        <button type="button" class="btn btn-primary btn-sm" data-action="search">Update results →</button>
      </div>${main}`;
  }
  const picked = S.results.filter(r => S.compare.includes(r.id));
  const tray = picked.length ? `<div class="compare-tray" role="region" aria-label="Compare">
      <span class="tech">Compare ${picked.length}/3</span>
      <div class="tray-items">${picked.map(p => `<span class="tray-chip"><span>${esc(p.title)}</span><button type="button" data-action="tray-remove" data-id="${p.id}" aria-label="Remove ${esc(p.title)} from compare">×</button></span>`).join("")}</div>
      <a class="btn btn-sm" href="#/compare" ${picked.length < 2 ? 'aria-disabled="true" data-action="need-two"' : ""}>Compare →</a>
    </div>` : "";
  return `<div class="results-layout ${isStale() ? "is-stale" : ""}">${filtersHtml()}<section class="results-main" aria-live="polite">${main}</section></div>${tray}`;
}

function compareView() {
  const picked = S.results.filter(r => S.compare.includes(r.id));
  if (picked.length < 2) return `<div class="wrap"><a class="back-link label" href="#/results">← Back to picks</a><p>Pick at least two to compare.</p></div>`;
  const row = (label, fn) => `<tr><th scope="row"><span class="label">${label}</span></th>${picked.map(p => `<td>${fn(p)}</td>`).join("")}</tr>`;
  return `<div class="wrap" style="display:flex;flex-direction:column;gap:20px">
    <a class="back-link label" href="#/results">← Back to picks</a>
    <h1 style="margin:0;font-family:var(--font-brand);font-weight:400;font-size:30px">Compare</h1>
    <div class="table-scroll"><table class="compare-table">
      <thead><tr><th scope="col"><span class="visually-hidden">Detail</span></th>${picked.map(p => `<th scope="col">${p.image ? `<img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}${esc(p.title)}</th>`).join("")}</tr></thead>
      <tbody>
        ${row("Source", p => `${kindTag(p.kind)} ${esc(p.source)}`)}
        ${row("Time", p => (p.minutes ? `${Math.round(p.minutes)} min` : "—"))}
        ${row("Uses", p => esc(p.uses.join(", ") || "—"))}
        ${row("Needs", p => esc(p.needs.join(", ") || "Nothing extra"))}
        ${row("Allergens", p => esc((p.allergens || []).join(", ") || "None common"))}
        ${row("In short", p => esc(p.summary || "—"))}
        ${row("", p => `<button type="button" class="btn btn-primary btn-sm" data-action="open-result" data-id="${p.id}">Open →</button>`)}
      </tbody>
    </table></div>
  </div>`;
}

// --------------------------------------------------------------------------
// Recipe
// --------------------------------------------------------------------------
function sourceBox(r) {
  const own = "Steps tidied by Sous-Chef. Amounts, times and heat are the cook's own.";
  if (r.kind === "video") {
    return `<div class="source-box">${kindTag("video")}<strong>${esc(r.source.name)}</strong><span class="muted" style="font-size:14px">YouTube</span>
      <a class="source-link" href="${esc(r.source.url)}" target="_blank" rel="noopener">Watch the original ↗</a><p>${own}</p></div>`;
  }
  if (r.kind === "blog") {
    return `<div class="source-box">${kindTag("blog")}<strong>${esc(r.source.name)}</strong><span class="muted" style="font-size:14px">${esc(hostName(r.source.url))}</span>
      <a class="source-link" href="${esc(r.source.url)}" target="_blank" rel="noopener">Read the original ↗</a><p>${own}</p></div>`;
  }
  if (r.kind === "paste") {
    return `<div class="source-box">${kindTag("paste")}<strong>${esc(r.source?.name || "Pasted post")}</strong><p>${own}</p></div>`;
  }
  return `<div class="source-box">${kindTag("classic")}<strong>A well-known dish</strong>
    <p>Written by Sous-Chef from the standard home version, not one cook's recipe. Check it against one you trust if it matters.</p></div>`;
}

function servingsLabel(r) {
  return r.servings ? `Serves ${formatAmount(r.servings * S.scale)}` : `×${formatAmount(S.scale)}`;
}

function ingredientRows(r) {
  const groups = new Map();
  r.ingredients.forEach(i => {
    const g = i.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(i);
  });
  return [...groups.entries()].map(([g, items]) => `<div class="ing-group">
    ${g ? `<h3 class="label">${esc(g)}</h3>` : ""}
    ${items.map(i => {
      const scaled = i.amount != null ? i.amount * S.scale : null;
      const shown = convertForDisplay(scaled, i.unit, prefs.units);
      const amt = shown.amount != null ? `${formatAmount(shown.amount)} ${shortUnit(shown.unit)}`.trim() : (i.unit || "to taste");
      const status = ingredientStatus(i.item, S.query.fridge, S.query.pantry);
      const swap = status === "need" ? findSwap(i.item) : null;
      const statusHtml = status === "have" ? `<span class="ing-status">✓ Have</span>`
        : status === "pantry" ? `<span class="ing-status pantry">Pantry</span>`
        : `<span class="tag tag-need">Need</span>`;
      return `<div class="ing-row"><span class="ing-amt">${esc(amt)}</span><span class="ing-name"><span>${esc(i.item)}</span>${swap ? `<button type="button" class="swap-btn" data-action="swap-pop" data-swap="${SWAPS.indexOf(swap)}" aria-expanded="false">Swap</button>` : ""}</span>${statusHtml}</div>`;
    }).join("")}
  </div>`).join("");
}

function findSwap(item) {
  const n = normalize(item);
  return SWAPS.find(s => s.tags.some(t => n.includes(t))) || null;
}

function safetyText(key) {
  const t = SAFE_TEMPS.find(s => s.key === key);
  if (!t) return "";
  if (t.look) return `Done when ${t.look.replace(/^until /i, "").toLowerCase()}`;
  return prefs.temp === "f" ? `Safe at ${t.f}°F` : `Safe at ${t.c}°C`;
}
function stepTimerKey(i) { return `${recipeKey(S.recipe)}#${i}`; }

function stepChips(step, i) {
  const chips = [];
  if (step.timerSeconds) chips.push(`<button type="button" class="chip-btn" data-action="step-timer" data-index="${i}" data-step-timer="${esc(stepTimerKey(i))}" data-default="⏱ ${clock(step.timerSeconds)}">⏱ ${clock(step.timerSeconds)}</button>`);
  if (step.safety) chips.push(`<a class="chip-btn safety" href="#/tools/temps?hl=${step.safety}">${esc(safetyText(step.safety))}</a>`);
  return chips.length ? `<div class="step-chips">${chips.join("")}</div>` : "";
}

function recipeView() {
  const back = S.results.length ? `<a class="back-link label" href="#/results">← Back to picks</a>` : `<a class="back-link label" href="#/">← New search</a>`;
  if (S.recipeStatus === "loading") {
    const what = S.item?.kind === "video" ? "Watching the video" : S.item?.kind === "classic" ? "Writing up the classic" : "Reading the recipe";
    return `<div class="wrap">${back}
      <div class="loading-state">
        ${says(`${what}<span class="dots"></span>`, { html: true })}
        <h1 style="margin:0;font-size:32px">${esc(S.item?.title || hostName(S.item?.url) || "Recipe")}</h1>
        <p class="muted" style="margin:0">${S.item?.kind === "video" ? "Videos take up to a minute." : "About 10–20 seconds."}</p>
      </div></div>`;
  }
  if (S.recipeStatus === "error") {
    const keyIssue = ["NO_KEY", "BAD_KEY", "MODEL"].includes(S.recipeErrorCode);
    return `<div class="wrap" style="display:flex;flex-direction:column;gap:20px">${back}
      ${says("Couldn't prep this one.")}
      ${errorNotice(S.recipeError, S.recipeDetail, `<button type="button" class="btn btn-primary btn-sm" data-action="retry-recipe">Try again</button>${keyIssue ? `<button type="button" class="btn btn-sm" data-open-settings>Keys</button>` : ""}${S.item?.url ? `<a class="btn btn-sm" href="${esc(S.item.url)}" target="_blank" rel="noopener">Open the original ↗</a>` : ""}`)}
    </div>`;
  }
  const r = S.recipe;
  if (!r) return `<div class="wrap">${back}<p>No recipe open. <a href="#/">Find one</a>.</p></div>`;

  const fridge = S.query.fridge;
  const usedCount = fridge.filter(f => r.ingredients.some(i => ingredientStatus(i.item, [f], false) === "have")).length;
  const meta = [r.minutes ? `${Math.round(r.minutes)} min` : null, r.servings ? `Serves ${formatAmount(r.servings)}` : null, fridge.length ? `Uses ${usedCount} of your ${fridge.length}` : null].filter(Boolean).join(" · ");
  const hits = avoidHits(r, S.query.avoid);
  const saved = isSaved(r);
  const unitBtn = (v, label) => `<button type="button" data-action="units" data-value="${v}" aria-pressed="${prefs.units === v}">${label}</button>`;

  return `<div class="wrap">
    ${back}
    <div class="recipe-top">
      <section class="recipe-head">
        ${meta ? `<p class="label">${esc(meta)}</p>` : ""}
        <h1>${esc(r.title)}</h1>
        ${sourceBox(r)}
        ${hits.length ? `<div class="notice notice-error"><p><strong>Heads up:</strong> this uses ${esc(hits.join(", "))}, which you're avoiding.</p></div>` : ""}
        <div class="recipe-actions">
          <a class="btn btn-primary btn-lg btn-start phone-only" href="#/cook">Start cooking →</a>
          <button type="button" class="btn" data-action="save-recipe" aria-pressed="${saved}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" ${saved ? 'fill="currentColor"' : ""}/></svg>${saved ? "Saved" : "Save"}</button>
          <button type="button" class="btn" data-action="print"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H3v-8h18v8h-3M7 14h10v7H7z"/></svg>Print</button>
          <button type="button" class="btn phone-only" data-action="copy-link">Share</button>
        </div>
      </section>
      <aside class="send-card card card-raised" aria-labelledby="send-h">
        <h2 id="send-h" class="label">Cook on your phone</h2>
        <div class="qr" id="qr" role="img" aria-label="QR code that opens this recipe on your phone"></div>
        <p>Scan to open cook mode, timers ready.</p>
        <div class="send-actions">
          <button type="button" class="btn btn-sm" data-action="copy-link">Copy link</button>
          <a class="btn btn-sm" href="#/cook">Cook here</a>
        </div>
      </aside>
    </div>

    <div class="recipe-cols">
      <section class="ingredients card" aria-labelledby="ing-h">
        <div class="ing-tools">
          <h2 id="ing-h">Ingredients</h2>
          <div class="stepper" role="group" aria-label="Servings"><button type="button" data-action="scale" data-dir="-1" aria-label="Fewer servings">−</button><span class="label">${esc(servingsLabel(r))}</span><button type="button" data-action="scale" data-dir="1" aria-label="More servings">+</button></div>
        </div>
        <div class="units">
          <span class="label" id="units-label">Show amounts in</span>
          <div class="seg seg-full" role="group" aria-labelledby="units-label">${unitBtn("original", "As written")}${unitBtn("metric", "Metric")}${unitBtn("us", "US")}</div>
          <p class="units-hint">${UNITS_HINT[prefs.units]}</p>
        </div>
        ${ingredientRows(r)}
      </section>

      <section class="steps" aria-labelledby="steps-h">
        <h2 id="steps-h" style="margin-bottom:6px">Steps</h2>
        <ol>${r.steps.map((s, i) => `<li class="step">
          <span class="step-num">${i + 1}</span>
          <div class="step-body">
            <div class="step-top"><span class="label">${esc(s.label)}</span>${s.videoSeconds != null && r.source?.url ? `<a href="${esc(videoLinkAt(r.source.url, s.videoSeconds))}" target="_blank" rel="noopener">▶ ${clock(s.videoSeconds)}</a>` : ""}</div>
            <p>${esc(s.text)}</p>
            ${stepChips(s, i)}
          </div></li>`).join("")}</ol>
      </section>
    </div>
  </div>`;
}
const UNITS_HINT = { original: "The cook's own units.", metric: "Converted to grams and millilitres.", us: "Converted to cups, ounces and spoons." };

// --------------------------------------------------------------------------
// Cook mode
// --------------------------------------------------------------------------
const cap = s => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1).toLowerCase();

function cookView() {
  const r = S.recipe;
  if (!r) {
    return `<div class="cook"><div class="cook-done">${robot({ type: "body" })}
      <h1 style="margin:0;font-family:var(--font-brand);font-weight:400">Nothing on the stove</h1>
      <p class="muted" style="margin:0">Find a recipe, or scan one from your computer.</p>
      <a class="btn btn-primary btn-lg" href="#/">Find a recipe →</a></div></div>`;
  }
  const total = r.steps.length;
  const i = Math.min(S.cookStep, total);
  const progress = `<div class="progress" style="grid-template-columns:repeat(${total},minmax(0,1fr))" role="img" aria-label="Step ${Math.min(i + 1, total)} of ${total}">${r.steps.map((_, k) => `<span class="${k <= i ? "on" : ""}"></span>`).join("")}</div>`;

  if (i >= total) {
    const saved = isSaved(r);
    return `<div class="cook">${progress}
      <div class="cook-done">${robot({ type: "body" })}
        ${bubble("Service! Enjoy, chef.", { tail: "left" })}
        <h1 style="margin:0;font-size:28px">${esc(r.title)}</h1>
        ${r.source?.url ? `<p style="margin:0">Thank the cook: <a href="${esc(r.source.url)}" target="_blank" rel="noopener">${esc(r.source.name)} ↗</a></p>` : ""}
        <div class="row-actions" style="justify-content:center">
          <button type="button" class="btn" data-action="save-recipe" aria-pressed="${saved}">${saved ? "Saved" : "Save"}</button>
          <button type="button" class="btn" data-action="cook-step" data-dir="-1">← Last step</button>
          <a class="btn btn-primary" href="#/">New search →</a>
        </div>
      </div></div>`;
  }

  const step = r.steps[i];
  const key = stepTimerKey(i);
  const t = T.bySource(key);
  let timerHtml = "";
  if (step.timerSeconds) {
    timerHtml = t
      ? `<section class="timer-card" aria-label="Step timer">
          <div class="head"><span class="label">${esc(step.label)}</span><span class="label">of ${clock(t.total)}</span></div>
          <span class="big" data-live-timer="${t.id}">${clock(Math.abs(T.remaining(t)))}</span>
          <div class="pair">
            <button type="button" class="btn btn-primary" data-action="timer-toggle" data-id="${t.id}">${t.state === "paused" ? "Resume" : t.state === "done" ? "Stop" : "Pause"}</button>
            <button type="button" class="btn" data-action="timer-add" data-id="${t.id}">+1 min</button>
          </div></section>`
      : `<section class="timer-card is-idle" aria-label="Step timer">
          <div class="head"><span class="label">${esc(step.label)}</span><span class="label">Timer</span></div>
          <span class="big">${clock(step.timerSeconds)}</span>
          <button type="button" class="btn btn-accent btn-lg" data-action="step-timer" data-index="${i}">Start timer</button>
        </section>`;
  }
  const chips = [];
  if (step.safety) chips.push(`<a class="chip-btn safety" href="#/tools/temps?hl=${step.safety}">${esc(safetyText(step.safety))}</a>`);
  if (step.videoSeconds != null && r.source?.url) chips.push(`<a class="chip-btn" href="${esc(videoLinkAt(r.source.url, step.videoSeconds))}" target="_blank" rel="noopener">▶ Watch at ${clock(step.videoSeconds)}</a>`);
  const next = i + 1 < total ? `Next: ${esc(cap(r.steps[i + 1].label))} →` : "Finish →";

  return `<div class="cook">
    ${progress}
    <div class="cook-top"><div><span class="label">Step ${i + 1} of ${total}</span><span class="sub">${esc(r.title)}${r.source?.name ? ` · ${esc(r.source.name)}` : ""}</span></div>
      <a class="icon-btn" href="#/recipe" aria-label="Leave cook mode">✕</a></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <span class="cook-label">${esc(cap(step.label))}</span>
      <p class="cook-text">${esc(step.text)}</p>
    </div>
    ${chips.length ? `<div class="cook-chips">${chips.join("")}</div>` : ""}
    ${timerHtml}
    <div class="cook-robot">${robot()}${bubble("wakeLock" in navigator ? "Screen stays awake. Yes, chef!" : "Keep your screen awake while cooking.", { tail: "left" })}</div>
    <div class="cook-nav">
      <button type="button" class="btn" data-action="cook-step" data-dir="-1" ${i === 0 ? "disabled" : ""}>← Back</button>
      <button type="button" class="btn btn-primary" data-action="cook-step" data-dir="1">${next}</button>
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// Tools
// --------------------------------------------------------------------------
function toolsView(tab, params) {
  const tabs = [["timers", "Timers"], ["convert", "Convert"], ["swaps", "Swaps"], ["temps", "Temps"]];
  const nav = `<nav class="seg seg-full" aria-label="Kitchen tools">${tabs.map(([k, l]) => `<a href="#/tools/${k}" ${k === tab ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  let body = "";
  if (tab === "timers") body = timersPanel();
  else if (tab === "convert") body = convertPanel();
  else if (tab === "swaps") body = swapsPanel();
  else if (tab === "temps") body = tempsPanel(params.get("hl"));
  return `<div class="tools"><h1>Kitchen tools</h1>${nav}${body}</div>`;
}

function timerItem(t) {
  const left = T.remaining(t);
  const stateLabel = { running: "Running", paused: "Paused", done: "Done" }[t.state];
  const pct = t.state === "done" ? 100 : Math.max(0, Math.min(100, 100 - (left / t.total) * 100));
  const ctrls = t.state === "done"
    ? `<button type="button" class="stop" data-action="timer-remove" data-id="${t.id}">Stop</button><button type="button" data-action="timer-repeat" data-id="${t.id}">Again</button>`
    : `<button type="button" class="dark" data-action="timer-toggle" data-id="${t.id}" aria-label="${t.state === "paused" ? "Resume" : "Pause"} ${esc(t.name)}">${t.state === "paused" ? '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M5 4h5v16H5zM14 4h5v16h-5z"/></svg>'}</button>
       <button type="button" data-action="timer-add" data-id="${t.id}">+1m</button>
       <button type="button" data-action="timer-remove" data-id="${t.id}" aria-label="Delete ${esc(t.name)}">✕</button>`;
  return `<section class="timer-item is-${t.state}" aria-label="${esc(t.name)} timer, ${t.state}">
    <div class="row1"><span class="name">${esc(t.name)}</span><span class="label">${stateLabel}</span></div>
    <div class="row2"><span class="time" data-live-timer="${t.id}">${t.state === "done" ? "+" : ""}${clock(Math.abs(left))}</span><span class="ctrls">${ctrls}</span></div>
    ${t.state === "done" ? `<span class="label">Past target</span>` : `<div class="bar"><i data-live-bar="${t.id}" style="width:${pct}%"></i></div>`}
  </section>`;
}

function timersPanel() {
  const list = T.list();
  return `<div id="timer-list" style="display:flex;flex-direction:column;gap:12px">${list.length ? list.map(timerItem).join("") : `<p class="empty">No timers yet. Start one here, or from any recipe step.</p>`}</div>
    <form class="new-timer" id="new-timer" novalidate>
      <label class="label" for="timer-name">New timer</label>
      <input class="input" id="timer-name" type="text" placeholder="Name it, e.g. Pasta" autocomplete="off">
      <div class="seg seg-full" role="group" aria-label="Quick start">
        <button type="button" data-action="timer-preset" data-sec="60">1 min</button>
        <button type="button" data-action="timer-preset" data-sec="300">5 min</button>
        <button type="button" data-action="timer-preset" data-sec="600">10 min</button>
        <button type="button" data-action="timer-preset" data-sec="900">15 min</button>
      </div>
      <div class="custom-row">
        <label class="visually-hidden" for="timer-min">Minutes</label>
        <input class="input" id="timer-min" type="number" min="0" step="1" inputmode="numeric" placeholder="min">
        <label class="visually-hidden" for="timer-sec">Seconds</label>
        <input class="input" id="timer-sec" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="sec">
        <button type="submit" class="btn btn-primary">Start</button>
      </div>
    </form>`;
}

function convertPanel() {
  const units = ["cup", "tbsp", "tsp", "ml", "l", "g", "kg", "oz", "lb"];
  return `<section class="tool-card card card-raised" aria-labelledby="cv-h">
      <h2 id="cv-h" class="label">Cups · spoons · grams</h2>
      <div class="convert-grid">
        <label class="field"><span class="label">Amount</span><input type="text" id="cv-amount" value="1" inputmode="decimal" autocomplete="off"></label>
        <label class="field"><span class="label">Unit</span><select id="cv-unit">${units.map(u => `<option ${u === "cup" ? "selected" : ""}>${u}</option>`).join("")}</select></label>
      </div>
      <label class="field"><span class="label">Ingredient</span><select id="cv-ing">
        <option value="">Any liquid · no weight</option>
        ${WEIGHTS.map((w, i) => `<option value="${i}" ${w.name === "All-purpose flour" ? "selected" : ""}>${esc(w.name)}</option>`).join("")}
      </select></label>
      <div class="result-line"><span class="label">Equals</span><span class="big" id="cv-big">—</span></div>
      <p class="equivs" id="cv-eq"></p>
      <p class="muted" style="margin:0;font-size:12px">Weights from King Arthur Baking. Flour spooned and leveled.</p>
    </section>
    <section class="tool-card card" aria-labelledby="ov-h">
      <h2 id="ov-h" class="label">Oven</h2>
      <div class="oven-grid">
        <label class="field"><span class="label">°C</span><input type="text" id="ov-c" value="180" inputmode="decimal"></label>
        <span aria-hidden="true" style="text-align:center;padding-bottom:14px">⇄</span>
        <label class="field"><span class="label">°F</span><input type="text" id="ov-f" value="356" inputmode="decimal"></label>
      </div>
      <div class="oven-presets" role="group" aria-label="Common oven settings">${OVEN_PRESETS.map(p => `<button type="button" data-action="oven" data-c="${p.c}" data-f="${p.f}" aria-pressed="${p.c === 180}">${p.c}°C · ${p.f}°F<small>Gas ${p.gas}</small></button>`).join("")}</div>
      <p class="muted" style="margin:0;font-size:12px">Usual dial settings, rounded. Typing converts exactly.</p>
    </section>`;
}

function updateConverter() {
  const amountEl = $("#cv-amount");
  if (!amountEl) return;
  const a = parseAmount(amountEl.value);
  const unit = $("#cv-unit").value;
  const ingIdx = $("#cv-ing").value;
  const ing = ingIdx === "" ? null : WEIGHTS[Number(ingIdx)];
  const big = $("#cv-big");
  const eq = $("#cv-eq");
  if (!Number.isFinite(a)) { big.textContent = "—"; eq.textContent = "Try 1.5, 1/2 or 1 1/2."; return; }
  const cupWord = c => `${formatAmount(c)} ${c > 1.06 ? "cups" : "cup"}`;
  const grams = g => `${g >= 100 ? Math.round(g) : Math.round(g * 10) / 10} g`;
  const fmtVol = ml => [cupWord(ml / VOLUME_ML.cup), `${formatAmount(ml / VOLUME_ML.tbsp)} tbsp`, `${formatAmount(ml / VOLUME_ML.tsp)} tsp`, `${Math.round(ml)} ml`].join(" · ");
  const fmtW = g => `${grams(g)} · ${formatAmount(g / WEIGHT_G.oz)} oz`;
  if (unit in VOLUME_ML) {
    const ml = a * VOLUME_ML[unit];
    if (ing) { const g = (ml / VOLUME_ML.cup) * ing.gPerCup; big.textContent = grams(g); eq.textContent = `${fmtW(g)} · ${fmtVol(ml)}`; }
    else { big.textContent = `${Math.round(ml)} ml`; eq.textContent = fmtVol(ml); }
  } else {
    const g = a * WEIGHT_G[unit];
    if (ing) { const ml = (g / ing.gPerCup) * VOLUME_ML.cup; big.textContent = cupWord(ml / VOLUME_ML.cup); eq.textContent = `${fmtVol(ml)} · ${fmtW(g)}`; }
    else { big.textContent = grams(g); eq.textContent = `${formatAmount(g / WEIGHT_G.oz)} oz · ${formatAmount(g / WEIGHT_G.lb)} lb. Pick an ingredient for cups.`; }
  }
}

function swapsPanel() {
  return `<div class="field"><label class="label" for="swap-q">Out of</label><div class="entry entry-lg" data-focus="swap-q"><input type="search" id="swap-q" placeholder="buttermilk, cornstarch…" autocomplete="off"></div></div>
    <div id="swap-out"></div>`;
}

function updateSwaps() {
  const out = $("#swap-out");
  if (!out) return;
  const q = normalize($("#swap-q").value);
  const match = s => !q || normalize(s.out).includes(q) || s.tags.some(t => q.includes(t) || t.includes(q));
  const hits = SWAPS.filter(match);
  const rest = q ? SWAPS.filter(s => !hits.includes(s)) : [];
  const feature = q && hits[0];
  out.innerHTML = `
    ${feature ? `<section class="swap-feature card card-raised" aria-label="${esc(feature.out)} swap" style="margin-bottom:18px">
      <span class="label">${esc(feature.amount)} ${esc(feature.out)} =</span>
      <p class="use">${esc(feature.use)}</p><p class="note">${esc(feature.note)}</p></section>` : ""}
    ${q && !hits.length ? `<p class="empty" style="margin-bottom:14px">No tested swap for that yet.</p>` : ""}
    <h2 class="label" style="margin-bottom:8px">${q ? "Other swaps" : "Common swaps"}</h2>
    <div class="swap-list">${(q ? [...hits.slice(1), ...rest] : SWAPS).map(s => `<div><strong>${esc(s.out)}, ${esc(s.amount)}</strong><span>${esc(s.use)}</span></div>`).join("")}</div>`;
}

function tempsPanel(hl) {
  const unitBtn = (v, l) => `<button type="button" data-action="temp-unit" data-value="${v}" aria-pressed="${prefs.temp === v}">${l}</button>`;
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <h2 class="label">Safe inside temperature</h2>
      <div class="seg" role="group" aria-label="Units">${unitBtn("c", "°C")}${unitBtn("f", "°F")}</div>
    </div>
    <div class="temp-table">${SAFE_TEMPS.map(t => `<div class="temp-row ${t.key === hl ? "is-hl" : ""}">
      <span class="what">${esc(t.label)}${t.note || t.look ? `<small>${esc(t.note || t.look)}</small>` : ""}</span>
      <span class="deg">${t.look ? "Look" : `${prefs.temp === "f" ? t.f : t.c}°`}</span></div>`).join("")}</div>
    <p class="muted" style="margin:0;font-size:13px">Check the thickest part, away from bone. From USDA food safety guidance.</p>`;
}

function savedView() {
  const list = loadSaved();
  return `<div class="wrap" style="max-width:820px;display:flex;flex-direction:column;gap:18px">
    <h1 style="margin:0;font-family:var(--font-brand);font-weight:400;font-size:28px">Saved</h1>
    ${list.length ? `<div class="saved-list">${list.map(s => `<div class="saved-item">
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
          <a href="#/recipe" data-action="open-saved" data-id="${s.id}">${esc(s.recipe.title)}</a>
          <span class="result-source">${kindTag(s.recipe.kind)}<span>${esc(s.recipe.source?.name || "Classic")}</span></span>
        </div>
        <div class="row-actions"><button type="button" class="btn btn-sm" data-action="cook-saved" data-id="${s.id}">Cook</button><button type="button" class="btn btn-sm" data-action="unsave" data-id="${s.id}">Remove</button></div>
      </div>`).join("")}</div>
      <p class="muted" style="margin:0;font-size:13px">Kept in this browser, so they open without internet.</p>` : says("Nothing saved yet, chef.")}
  </div>`;
}

// --------------------------------------------------------------------------
// Actions
// --------------------------------------------------------------------------
const FRIDGE_INPUTS = ["q-input", "fridge-side"];
const AVOID_INPUTS = ["avoid-input", "avoid-side"];

// Move typed text into chips. Returns a URL if one was typed instead.
function flushInput(id) {
  const input = document.getElementById(id);
  if (!input) return "";
  const value = input.value.trim();
  if (!value) return "";
  if (isUrl(value)) return value;
  if (id === "q-input" && S.query.mode === "dish") { S.query.dish = value; saveState(); return ""; }
  const list = AVOID_INPUTS.includes(id) ? S.query.avoid : S.query.fridge;
  value.split(/[,，、\n]/).map(v => v.trim()).filter(Boolean).forEach(v => {
    if (!list.some(x => normalize(x) === normalize(v))) list.push(v);
  });
  input.value = "";
  saveState();
  return "";
}
function flushAll() { [...FRIDGE_INPUTS, ...AVOID_INPUTS].forEach(flushInput); const d = $("#dish-side"); if (d) S.query.dish = d.value.trim(); }

function rerenderKeepingFocus(focusId) {
  render().then(() => { const el = focusId && document.getElementById(focusId); if (el) el.focus(); });
}

async function runSearch() {
  const q = S.query;
  if (q.mode === "have" && !q.fridge.length) { toast("Add at least one ingredient."); return; }
  if (q.mode === "dish" && !q.dish.trim()) { toast("Type a dish first."); return; }
  if (!q.sources.video && !q.sources.blog && !q.sources.classic) { toast("Turn on at least one source."); return; }
  if (!ai.getKey()) { openSettings("Add your Gemini key to search."); return; }
  S.searchStatus = "loading"; S.results = []; S.compare = []; S.warnings = []; S.lastQueryKey = queryKey(); saveState();
  go("#/results");
  try {
    const { results, warnings } = await ai.findRecipes({
      fridge: q.fridge, dish: q.mode === "dish" ? q.dish : "", avoid: q.avoid, pantry: q.pantry, maxMinutes: q.maxMinutes, sources: q.sources,
    });
    S.results = results.map(r => ({ ...r, id: uid() }));
    S.warnings = warnings;
    S.searchStatus = "done";
  } catch (err) {
    S.searchStatus = "error";
    S.searchError = ai.errorMessage(err);
    S.searchDetail = ai.errorDetail(err);
    S.searchCode = err?.code || "";
  }
  saveState();
  if (parseHash().path === "/results") render();
}

// What the last search was for, so the page can tell when filters changed.
function queryKey(q = S.query) {
  const sorted = list => [...list].map(normalize).sort();
  return JSON.stringify({ m: q.mode, f: q.mode === "have" ? sorted(q.fridge) : [], d: q.mode === "dish" ? normalize(q.dish) : "", a: sorted(q.avoid), p: q.pantry, t: q.maxMinutes || null, s: q.sources });
}
const isStale = () => S.searchStatus === "done" && S.lastQueryKey && queryKey() !== S.lastQueryKey;
function markStale() {
  if (parseHash().path !== "/results") return;
  const stale = isStale();
  $(".results-layout")?.classList.toggle("is-stale", stale);
  const banner = $("#stale-banner");
  if (banner) banner.hidden = !stale;
  const btn = $("[data-action='search']");
  if (btn) btn.textContent = stale ? "Update results →" : "Search again";
}

const cacheKeyFor = item => `souschef_recipe_${item.url || `classic:${normalize(item.title)}`}`;

async function openItem(item) {
  S.item = item;
  S.scale = 1; S.cookStep = 0;
  const cached = sessionStorage.getItem(cacheKeyFor(item));
  if (cached) {
    try { S.recipe = JSON.parse(cached); S.recipeStatus = "done"; saveState(); go("#/recipe"); return; } catch { sessionStorage.removeItem(cacheKeyFor(item)); }
  }
  if (!ai.getKey()) { openSettings("Add your Gemini key to open recipes."); return; }
  S.recipeStatus = "loading"; S.recipe = null; saveState();
  go("#/recipe");
  try {
    const recipe = await ai.loadRecipe(item, { fridge: S.query.fridge, avoid: S.query.avoid, pantry: S.query.pantry });
    if (item.kind !== "classic" && item.source && recipe.source) recipe.source.name = item.source;
    S.recipe = recipe; S.recipeStatus = "done";
    try { sessionStorage.setItem(cacheKeyFor(item), JSON.stringify(recipe)); } catch { /* full */ }
  } catch (err) {
    S.recipeStatus = "error"; S.recipeError = ai.errorMessage(err); S.recipeDetail = ai.errorDetail(err); S.recipeErrorCode = err?.code || "";
  }
  saveState();
  if (parseHash().path === "/recipe") render();
}

function importLink(url) {
  if (isRedNote(url)) { openPaste("RedNote doesn't let other sites open its posts. Paste the text or a screenshot instead."); return; }
  openItem({ kind: youtubeId(url) ? "video" : "blog", url, title: "", source: youtubeId(url) ? "" : hostName(url) });
}

async function shareUrl() {
  const packed = await packRecipe(S.recipe);
  return `${location.origin}${location.pathname}#/cook?r=${packed}`;
}

async function buildQr() {
  const box = $("#qr");
  if (!box || !S.recipe || typeof qrcode !== "function") return;
  try {
    const qr = qrcode(0, "L");
    qr.addData(await shareUrl());
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  } catch {
    box.removeAttribute("role");
    box.style.aspectRatio = "auto";
    box.innerHTML = `<p class="muted" style="font-size:13px">Too long for a QR code. Use Copy link.</p>`;
  }
}

async function copyLink() {
  try {
    const url = await shareUrl();
    if (navigator.share && matchMedia("(max-width: 760px)").matches) { await navigator.share({ title: S.recipe.title, url }).catch(() => {}); return; }
    await navigator.clipboard.writeText(url);
    toast("Link copied. Open it on your phone.");
  } catch {
    toast("Couldn't copy the link.");
  }
}

function toggleSave() {
  const list = loadSaved();
  const key = recipeKey(S.recipe);
  const idx = list.findIndex(s => recipeKey(s.recipe) === key);
  if (idx >= 0) { list.splice(idx, 1); toast("Removed from saved."); }
  else { list.unshift({ id: uid(), savedAt: Date.now(), recipe: S.recipe }); toast("Saved."); }
  storeSaved(list);
  updateSavedCount();
  render();
}

function startStepTimer(i) {
  const step = S.recipe.steps[i];
  const key = stepTimerKey(i);
  if (T.bySource(key)) { go("#/tools/timers"); return; }
  T.add(`${cap(step.label)} · step ${i + 1}`, step.timerSeconds, key);
  render();
}

function openSavedRecipe(id, hash) {
  const s = loadSaved().find(x => x.id === id);
  if (!s) return;
  S.recipe = s.recipe; S.item = null; S.recipeStatus = "done"; S.scale = 1; S.cookStep = 0;
  saveState(); go(hash);
}

// Swap bubble next to an ingredient
let openPop = null;
function closePop() {
  if (!openPop) return;
  openPop.el.remove();
  openPop.btn.setAttribute("aria-expanded", "false");
  openPop = null;
}
function showSwap(btn) {
  const same = openPop?.btn === btn;
  closePop();
  if (same) return;
  const swap = SWAPS[Number(btn.dataset.swap)];
  if (!swap) return;
  const el = document.createElement("div");
  el.className = "popover";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", `${swap.out} swap`);
  el.innerHTML = `<span class="label">Instead of ${esc(swap.amount)} ${esc(swap.out.toLowerCase())}</span>
    <p class="use">${esc(swap.use)}</p><p class="note">${esc(swap.note)}</p>
    <button type="button" class="pop-close" aria-label="Close">✕</button>`;
  document.body.appendChild(el);
  const r = btn.getBoundingClientRect();
  const w = el.offsetWidth;
  const left = Math.max(16, Math.min(r.left + window.scrollX - 16, window.scrollX + document.documentElement.clientWidth - w - 16));
  el.style.left = `${left}px`;
  el.style.top = `${r.bottom + window.scrollY + 12}px`;
  el.style.setProperty("--arrow", `${Math.max(12, r.left + window.scrollX - left + r.width / 2 - 8)}px`);
  el.querySelector(".pop-close").addEventListener("click", () => { closePop(); btn.focus(); });
  btn.setAttribute("aria-expanded", "true");
  openPop = { el, btn };
}
document.addEventListener("pointerdown", e => { if (openPop && !openPop.el.contains(e.target) && e.target !== openPop.btn) closePop(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && openPop) { const b = openPop.btn; closePop(); b.focus(); } });
window.addEventListener("hashchange", closePop);
window.addEventListener("resize", closePop);

const actions = {
  "swap-pop": el => showSwap(el),
  "mode": el => { flushAll(); S.query.mode = el.dataset.mode; saveState(); rerenderKeepingFocus("q-input"); },
  "chip-remove": el => { const list = el.dataset.kind === "avoid" ? S.query.avoid : S.query.fridge; list.splice(Number(el.dataset.index), 1); saveState(); render(); },
  "pantry": el => { S.query.pantry = el.checked; saveState(); markStale(); },
  "time": el => { S.query.maxMinutes = el.dataset.value ? Number(el.dataset.value) : null; saveState(); $$("[data-action='time']").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.value === el.dataset.value))); markStale(); },
  "source": el => { S.query.sources[el.dataset.source] = el.checked; saveState(); markStale(); },
  "search": () => { flushAll(); runSearch(); },
  "compare": el => {
    const id = el.dataset.id;
    if (el.checked) {
      if (S.compare.length >= 3) { el.checked = false; toast("Compare up to 3 at a time."); return; }
      S.compare.push(id);
    } else S.compare = S.compare.filter(x => x !== id);
    saveState(); render();
  },
  "tray-remove": el => { S.compare = S.compare.filter(x => x !== el.dataset.id); saveState(); render(); },
  "need-two": (el, e) => { e.preventDefault(); toast("Pick one more to compare."); },
  "open-result": el => { const r = S.results.find(x => x.id === el.dataset.id); if (r) openItem(r); },
  "retry-recipe": () => { if (S.item) { sessionStorage.removeItem(cacheKeyFor(S.item)); openItem(S.item); } },
  "scale": el => {
    const r = S.recipe;
    const dir = Number(el.dataset.dir);
    if (r.servings) S.scale = Math.max(1, Math.round(r.servings * S.scale) + dir) / r.servings;
    else S.scale = Math.max(0.5, S.scale + dir * 0.5);
    saveState(); render();
  },
  "units": el => { prefs.units = el.dataset.value; savePrefs(); closePop(); render(); },
  "save-recipe": () => toggleSave(),
  "print": () => window.print(),
  "copy-link": () => copyLink(),
  "step-timer": el => startStepTimer(Number(el.dataset.index)),
  "cook-step": el => {
    S.cookStep = Math.max(0, Math.min(S.recipe.steps.length, S.cookStep + Number(el.dataset.dir)));
    saveState(); render(); window.scrollTo(0, 0);
  },
  "timer-toggle": el => { const t = T.list().find(x => x.id === el.dataset.id); if (!t) return; if (t.state === "running") T.pause(t.id); else if (t.state === "paused") T.resume(t.id); else T.remove(t.id); },
  "timer-add": el => T.addTime(el.dataset.id, 60),
  "timer-remove": el => T.remove(el.dataset.id),
  "timer-repeat": el => T.repeat(el.dataset.id),
  "timer-preset": el => { const name = $("#timer-name").value.trim(); const sec = Number(el.dataset.sec); T.add(name || `${sec / 60} min`, sec); $("#timer-name").value = ""; },
  "oven": el => { $("#ov-c").value = el.dataset.c; $("#ov-f").value = el.dataset.f; $$("[data-action='oven']").forEach(b => b.setAttribute("aria-pressed", String(b === el))); },
  "temp-unit": el => { prefs.temp = el.dataset.value; savePrefs(); render(); },
  "open-saved": (el, e) => { e.preventDefault(); openSavedRecipe(el.dataset.id, "#/recipe"); },
  "cook-saved": el => openSavedRecipe(el.dataset.id, "#/cook"),
  "unsave": el => { storeSaved(loadSaved().filter(x => x.id !== el.dataset.id)); updateSavedCount(); render(); },
  "open-paste": () => openPaste(),
};

document.addEventListener("click", e => {
  if (e.target.closest("[data-open-settings]")) { e.preventDefault(); openSettings(); return; }
  const el = e.target.closest("[data-action]");
  if (el && el.type !== "checkbox") { actions[el.dataset.action]?.(el, e); return; }
  // Clicking anywhere in a chip box focuses its input.
  const box = e.target.closest(".entry[data-focus]");
  if (box && !e.target.closest("button, input")) document.getElementById(box.dataset.focus)?.focus();
});

document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches("input[type='checkbox'][data-action]")) actions[el.dataset.action]?.(el, e);
  if (el.id === "cv-unit" || el.id === "cv-ing") updateConverter();
  if (el.id === "dish-side") { S.query.dish = el.value.trim(); saveState(); markStale(); }
});

document.addEventListener("input", e => {
  const el = e.target;
  if (el.id === "cv-amount") updateConverter();
  if (el.id === "swap-q") updateSwaps();
  if (el.id === "ov-c" || el.id === "ov-f") {
    const v = parseFloat(el.value);
    const other = el.id === "ov-c" ? $("#ov-f") : $("#ov-c");
    if (Number.isFinite(v)) other.value = String(Math.round(el.id === "ov-c" ? v * 9 / 5 + 32 : (v - 32) * 5 / 9));
    $$("[data-action='oven']").forEach(b => b.setAttribute("aria-pressed", String(Number($("#ov-c").value) === Number(b.dataset.c))));
  }
});

document.addEventListener("keydown", e => {
  const el = e.target;
  const chipInput = [...FRIDGE_INPUTS, ...AVOID_INPUTS].includes(el.id) && !(el.id === "q-input" && S.query.mode === "dish");
  if (chipInput) {
    if (e.key === "Enter" || e.key === ",") {
      const value = el.value.trim();
      if (FRIDGE_INPUTS.includes(el.id) && isUrl(value)) { e.preventDefault(); el.value = ""; importLink(value); return; }
      if (e.key === "Enter" && !value && el.id === "q-input") return; // empty Enter submits the search
      e.preventDefault();
      flushInput(el.id);
      rerenderKeepingFocus(el.id);
      return;
    }
    if (e.key === "Backspace" && !el.value) {
      const list = AVOID_INPUTS.includes(el.id) ? S.query.avoid : S.query.fridge;
      if (list.length) { list.pop(); saveState(); rerenderKeepingFocus(el.id); }
    }
    return;
  }
  if (el.id === "dish-side" && e.key === "Enter") { e.preventDefault(); S.query.dish = el.value.trim(); runSearch(); return; }
  if (parseHash().path === "/cook" && S.recipe && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) {
    if (e.key === "ArrowRight") { S.cookStep = Math.min(S.recipe.steps.length, S.cookStep + 1); saveState(); render(); }
    if (e.key === "ArrowLeft") { S.cookStep = Math.max(0, S.cookStep - 1); saveState(); render(); }
  }
});

document.addEventListener("submit", e => {
  const form = e.target;
  if (form.id === "search-form") {
    e.preventDefault();
    const value = $("#q-input").value.trim();
    if (isUrl(value)) { $("#q-input").value = ""; importLink(value); return; }
    flushAll();
    runSearch();
  }
  if (form.id === "new-timer") {
    e.preventDefault();
    const total = (Number($("#timer-min").value) || 0) * 60 + (Number($("#timer-sec").value) || 0);
    if (total <= 0) { toast("Set minutes or seconds first."); return; }
    T.add($("#timer-name").value.trim() || `${clock(total)}`, total);
    form.reset();
  }
});

// --------------------------------------------------------------------------
// Timers: dock, live numbers, alarm
// --------------------------------------------------------------------------
const dock = $("#dock");
let timerSignature = "";
let dockSignature = "";
const alerted = new Set();

function refreshLive() {
  const list = T.list();
  const now = Date.now();
  list.forEach(t => {
    const left = T.remaining(t, now);
    const text = `${t.state === "done" ? "+" : ""}${clock(Math.abs(left))}`;
    $$(`[data-live-timer="${t.id}"]`).forEach(el => { el.textContent = text; });
    $$(`[data-live-bar="${t.id}"]`).forEach(el => { el.style.width = `${Math.max(0, Math.min(100, 100 - (left / t.total) * 100))}%`; });
  });
  $$("[data-step-timer]").forEach(el => {
    const t = list.find(x => x.source === el.dataset.stepTimer);
    el.classList.toggle("is-live", !!t && t.state !== "done");
    el.classList.toggle("is-done", !!t && t.state === "done");
    el.textContent = t ? `${t.state === "done" ? "Done +" : t.state === "paused" ? "Paused " : "● "}${clock(Math.abs(T.remaining(t, now)))}` : el.dataset.default;
  });
  renderDock(list, now);
  updateAlarm(list, now);
}

function renderDock(list, now) {
  const show = list.length && parseHash().path !== "/tools/timers";
  dock.hidden = !show;
  if (show) {
    const shown = list.slice(0, 4);
    const sig = shown.map(t => `${t.id}:${t.state}:${t.name}`).join("|") + list.length;
    if (sig !== dockSignature) {
      dockSignature = sig;
      dock.innerHTML = shown.map(t => `<a class="dock-timer is-${t.state}" href="#/tools/timers"><span>${esc(t.name.toUpperCase())}</span><span data-dock-time="${t.id}"></span></a>`).join("")
        + (list.length > 4 ? `<a class="dock-more" href="#/tools/timers">+${list.length - 4} more</a>` : "");
    }
    shown.forEach(t => {
      const el = dock.querySelector(`[data-dock-time="${t.id}"]`);
      if (el) el.textContent = `${t.state === "done" ? "+" : ""}${clock(Math.abs(T.remaining(t, now)))}`;
    });
  } else {
    dockSignature = "";
  }
  document.documentElement.style.setProperty("--dock-h", `${show ? dock.offsetHeight : 0}px`);
}

const alarmDialog = $("#alarm-dialog");
let alarmId = null;
function updateAlarm(list, now) {
  list.filter(t => t.state === "done").forEach(t => {
    if (!alerted.has(t.id) && !alarmDialog.open) {
      alerted.add(t.id);
      alarmId = t.id;
      $("#alarm-title").textContent = `${t.name} is done`;
      try { alarmDialog.showModal(); } catch { /* already open */ }
    }
  });
  if (alarmDialog.open) {
    const t = list.find(x => x.id === alarmId);
    if (!t || t.state !== "done") alarmDialog.close();
    else $("#alarm-over").textContent = `+${clock(Math.abs(T.remaining(t, now)))}`;
  }
  [...alerted].forEach(id => { if (!list.some(t => t.id === id && t.state === "done")) alerted.delete(id); });
}
$("#alarm-stop").addEventListener("click", () => { if (alarmId) T.remove(alarmId); alarmDialog.close(); });
$("#alarm-more").addEventListener("click", () => { if (alarmId) T.addTime(alarmId, 60); alarmDialog.close(); });

T.subscribe(list => {
  const sig = list.map(t => `${t.id}:${t.state}`).join("|");
  const structural = sig !== timerSignature;
  timerSignature = sig;
  const path = parseHash().path;
  if (structural && (path === "/tools/timers" || path === "/cook")) {
    const active = document.activeElement?.id;
    render().then(() => { if (active) document.getElementById(active)?.focus(); });
  } else {
    refreshLive();
  }
});

// --------------------------------------------------------------------------
// Dialogs
// --------------------------------------------------------------------------
const settingsDialog = $("#settings-dialog");
function openSettings(message = "") {
  $("#key-input").value = ai.getKey();
  $("#key-input").type = "password";
  $("#key-show").textContent = "Show";
  $("#yt-input").value = ai.getYtKey();
  $("#model-input").value = ai.getModel() === ai.DEFAULT_MODEL ? "" : ai.getModel();
  $("#model-input").placeholder = `Default: ${ai.DEFAULT_MODEL}`;
  const status = $("#settings-status");
  status.textContent = message;
  status.classList.toggle("is-error", !!message);
  settingsDialog.showModal();
  $("#key-input").focus();
}
$("#key-show").addEventListener("click", e => {
  const input = $("#key-input");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  e.currentTarget.textContent = show ? "Hide" : "Show";
  e.currentTarget.setAttribute("aria-pressed", String(show));
});
$("#settings-form").addEventListener("submit", e => {
  const key = $("#key-input").value.trim();
  if (!key) { e.preventDefault(); $("#settings-status").textContent = "Paste a Gemini key first."; $("#settings-status").classList.add("is-error"); return; }
  ai.setKey(key);
  ai.setYtKey($("#yt-input").value);
  ai.setModel($("#model-input").value);
  toast("Saved in this browser.");
  render();
});
$("#key-clear").addEventListener("click", () => {
  ai.clearKey();
  ai.setYtKey("");
  $("#key-input").value = "";
  $("#yt-input").value = "";
  $("#settings-status").textContent = "Keys removed from this browser.";
  $("#settings-status").classList.remove("is-error");
  render();
});

const pasteDialog = $("#paste-dialog");
function openPaste(note) {
  $("#paste-note").textContent = note || "From RedNote or any app Sous-Chef can't open. Text, a screenshot, or both.";
  $("#paste-status").textContent = "";
  pasteDialog.showModal();
}
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }
    if (file.size > 8 * 1024 * 1024) { reject(new Error("That image is over 8 MB.")); return; }
    const reader = new FileReader();
    reader.onload = () => resolve({ mimeType: file.type || "image/jpeg", base64: String(reader.result).split(",")[1] });
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(file);
  });
}
$("#paste-form").addEventListener("submit", async e => {
  e.preventDefault();
  const text = $("#paste-text").value.trim();
  const file = $("#paste-image").files[0];
  const status = $("#paste-status");
  if (!text && !file) { status.textContent = "Paste some text or add a screenshot."; status.classList.add("is-error"); return; }
  if (!ai.getKey()) { pasteDialog.close(); openSettings("Add your Gemini key first."); return; }
  let image;
  try { image = await readImage(file); } catch (err) { status.textContent = err.message; status.classList.add("is-error"); return; }
  status.classList.remove("is-error");
  status.textContent = "Prepping…";
  const submit = e.target.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    const recipe = await ai.fromPaste({ text, image, sourceName: $("#paste-source").value.trim() }, { fridge: S.query.fridge, avoid: S.query.avoid, pantry: S.query.pantry });
    S.recipe = recipe; S.item = null; S.recipeStatus = "done"; S.scale = 1; S.cookStep = 0; saveState();
    pasteDialog.close();
    e.target.reset();
    go("#/recipe");
  } catch (err) {
    status.textContent = `${ai.errorMessage(err)}${ai.errorDetail(err) ? ` (${ai.errorDetail(err)})` : ""}`;
    status.classList.add("is-error");
  } finally {
    submit.disabled = false;
  }
});
$$("dialog [data-close]").forEach(btn => btn.addEventListener("click", () => btn.closest("dialog").close()));

// --------------------------------------------------------------------------
// Toast + start
// --------------------------------------------------------------------------
let toastTimer;
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

paintRobots(document);
updateSavedCount();
render();
