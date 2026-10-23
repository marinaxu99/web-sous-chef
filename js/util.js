// ==========================================================================
// Web Sous-Chef — small helpers (no AI, no network)
// ==========================================================================
import { PANTRY, VOLUME_ML, WEIGHT_G } from "./data.js";

// Escape any text before it goes into HTML. All AI text passes through this.
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function isUrl(text) {
  return /^https?:\/\/\S+$/i.test(String(text).trim());
}

export function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  return null;
}

export function isRedNote(url) {
  try { return /xiaohongshu\.com|xhslink\.com|rednote/i.test(new URL(url).hostname); } catch { return false; }
}

export function hostName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// "2:10" or "1:02:10" -> seconds
export function parseClock(text) {
  if (!text) return null;
  const parts = String(text).trim().split(":").map(Number);
  if (parts.some(n => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function clock(totalSeconds, { showHours = false } = {}) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 || showHours ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function videoLinkAt(url, seconds) {
  const id = youtubeId(url);
  if (!id || seconds == null) return url;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&t=${Math.floor(seconds)}s`;
}

// ---------- amounts ----------
const FRACTIONS = [[0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];

export function formatAmount(value) {
  if (value == null || Number.isNaN(value)) return "";
  if (value >= 20) return String(Math.round(value));
  const whole = Math.floor(value);
  const rest = value - whole;
  if (rest < 0.06) return String(whole || 0);
  if (rest > 0.94) return String(whole + 1);
  let best = null;
  for (const [num, glyph] of FRACTIONS) {
    if (Math.abs(rest - num) < 0.06) best = glyph;
  }
  if (best) return whole ? `${whole}${best}` : best;
  return String(Math.round(value * 10) / 10);
}

// Accepts "1.5", "1/2", "1 1/2", "½"
export function parseAmount(text) {
  const t = String(text).trim().replace(/[¼½¾⅓⅔⅛]/g, ch => ({ "¼": " 1/4", "½": " 1/2", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3", "⅛": " 1/8" })[ch]).trim();
  if (!t) return NaN;
  let total = 0;
  for (const part of t.split(/\s+/)) {
    if (part.includes("/")) {
      const [a, b] = part.split("/").map(Number);
      if (!b) return NaN;
      total += a / b;
    } else {
      const n = Number(part);
      if (Number.isNaN(n)) return NaN;
      total += n;
    }
  }
  return total;
}

// ---------- units ----------
const UNIT_ALIASES = {
  cup: ["cup", "cups", "c"], tbsp: ["tbsp", "tablespoon", "tablespoons", "tbs", "tbl"],
  tsp: ["tsp", "teaspoon", "teaspoons"], ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"], g: ["g", "gram", "grams", "gr"],
  kg: ["kg", "kilogram", "kilograms"], oz: ["oz", "ounce", "ounces"], lb: ["lb", "lbs", "pound", "pounds"],
};

export function canonicalUnit(unit) {
  const u = String(unit || "").trim().toLowerCase().replace(/\.$/, "");
  for (const [key, list] of Object.entries(UNIT_ALIASES)) if (list.includes(u)) return key;
  return null;
}

const SHORT_UNITS = {
  tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", tbl: "tbsp", teaspoon: "tsp", teaspoons: "tsp",
  pound: "lb", pounds: "lb", lbs: "lb", ounce: "oz", ounces: "oz", gram: "g", grams: "g", gr: "g",
  kilogram: "kg", kilograms: "kg", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l", cups: "cup", clove: "clove", cloves: "cloves",
};
export function shortUnit(unit) {
  const u = String(unit || "").trim();
  return SHORT_UNITS[u.toLowerCase()] || u;
}

// Convert an ingredient amount for display. system: "original" | "metric" | "us"
export function convertForDisplay(amount, unit, system) {
  const u = canonicalUnit(unit);
  if (amount == null || system === "original" || !u) return { amount, unit };
  if (system === "metric") {
    if (u in WEIGHT_G && u !== "g" && u !== "kg") {
      const g = amount * WEIGHT_G[u];
      return g >= 1000 ? { amount: g / 1000, unit: "kg" } : { amount: Math.round(g), unit: "g" };
    }
    if (u === "cup") return { amount: Math.round(amount * VOLUME_ML.cup), unit: "ml" };
    return { amount, unit };
  }
  // US
  if (u === "g" || u === "kg") {
    const oz = amount * WEIGHT_G[u] / WEIGHT_G.oz;
    return oz >= 16 ? { amount: oz / 16, unit: "lb" } : { amount: oz, unit: "oz" };
  }
  if (u === "ml" || u === "l") {
    const ml = amount * VOLUME_ML[u];
    if (ml >= VOLUME_ML.cup / 4) return { amount: ml / VOLUME_ML.cup, unit: "cup" };
    if (ml >= VOLUME_ML.tbsp) return { amount: ml / VOLUME_ML.tbsp, unit: "tbsp" };
    return { amount: ml / VOLUME_ML.tsp, unit: "tsp" };
  }
  return { amount, unit };
}

// ---------- ingredient matching ----------
export function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9぀-ヿ㐀-鿿가-힯 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function stem(word) {
  return word.replace(/(ies)$/, "y").replace(/(oes)$/, "o").replace(/s$/, "");
}

const FILLER = new Set(["and", "or", "of", "fresh", "large", "small", "medium", "chopped", "minced", "sliced", "diced", "boneless", "skinless", "cooked", "to", "taste", "for", "the", "a"]);
const words = text => normalize(text).split(" ").map(stem).filter(w => w && !FILLER.has(w));

// True when every meaningful word of one name appears in the other,
// so "day-old rice" matches "cooked rice, day-old".
function mentions(haystack, needle) {
  const h = words(haystack);
  const n = words(needle);
  if (!h.length || !n.length) return false;
  return n.every(w => h.includes(w)) || h.every(w => n.includes(w));
}

// "have" | "pantry" | "need"
export function ingredientStatus(itemName, fridge, usePantry) {
  if (fridge.some(f => mentions(itemName, f))) return "have";
  if (usePantry && PANTRY.some(p => mentions(itemName, p))) return "pantry";
  return "need";
}

export function avoidHits(recipe, avoid) {
  if (!avoid?.length) return [];
  const text = (recipe.ingredients || []).map(i => i.item).join(" | ");
  return avoid.filter(a => mentions(text, a) || normalize(text).includes(normalize(a)));
}

// ---------- compact share links (no server) ----------
function toBase64Url(bytes) {
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export async function packRecipe(recipe) {
  // Short keys keep the QR code small enough to scan from a screen.
  const compact = {
    t: recipe.title, k: recipe.kind, m: recipe.minutes, sv: recipe.servings,
    s: recipe.source ? [recipe.source.name, recipe.source.url] : null,
    i: (recipe.ingredients || []).map(x => [x.amount, x.unit, x.item, x.group || ""]),
    st: (recipe.steps || []).map(x => [x.label, x.text, x.timerSeconds ?? null, x.videoSeconds ?? null, x.safety || null]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64Url(packed);
}

export async function unpackRecipe(text) {
  const bytes = fromBase64Url(text);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const c = JSON.parse(await new Response(stream).text());
  return {
    title: c.t, kind: c.k, minutes: c.m, servings: c.sv,
    source: c.s ? { name: c.s[0], url: c.s[1] } : null,
    ingredients: (c.i || []).map(([amount, unit, item, group]) => ({ amount, unit, item, group })),
    steps: (c.st || []).map(([label, text, timerSeconds, videoSeconds, safety]) => ({ label, text, timerSeconds, videoSeconds, safety })),
  };
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
