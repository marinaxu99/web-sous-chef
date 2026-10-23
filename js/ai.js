// ==========================================================================
// Web Sous-Chef — every Gemini and YouTube call lives in this file.
//
// For now the browser calls Google directly with the person's own key
// (kept in localStorage, sent in the x-goog-api-key header).
// To go public later, point callGemini() and ytFetch() at your own server
// and remove the key handling. Nothing else in the app needs to change.
// ==========================================================================
import { youtubeId, hostName, parseClock, isUrl } from "./util.js";

const KEY_STORAGE = "souschef_gemini_key";
const YT_KEY_STORAGE = "souschef_youtube_key";
const MODEL_STORAGE = "souschef_gemini_model";
// Tried in order. If one is missing, busy or over its limit, the next one is used.
export const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-3.5-flash"];
const MODELS_STORAGE = "souschef_gemini_models";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RESULTS = 6;
const RECENT_YEARS = 3;

export const getKey = () => localStorage.getItem(KEY_STORAGE) || "";
export const setKey = key => localStorage.setItem(KEY_STORAGE, key.trim());
export const clearKey = () => localStorage.removeItem(KEY_STORAGE);
export const getYtKey = () => localStorage.getItem(YT_KEY_STORAGE) || "";
export const setYtKey = key => (key.trim() ? localStorage.setItem(YT_KEY_STORAGE, key.trim()) : localStorage.removeItem(YT_KEY_STORAGE));
export const getModels = () => {
  const saved = (localStorage.getItem(MODELS_STORAGE) || "").split(/[\s,]+/).map(m => m.trim()).filter(Boolean);
  return saved.length ? saved : DEFAULT_MODELS;
};
export const setModels = text => {
  const list = String(text || "").split(/[\s,]+/).map(m => m.trim()).filter(Boolean);
  if (!list.length || list.join(",") === DEFAULT_MODELS.join(",")) localStorage.removeItem(MODELS_STORAGE);
  else localStorage.setItem(MODELS_STORAGE, list.join(","));
};
// The old single-model setting could hold a name that no longer exists; drop it.
localStorage.removeItem(MODEL_STORAGE);

export class AiError extends Error {
  constructor(code, message, detail = "") {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

const MESSAGES = {
  NO_KEY: "Add your Gemini key to search and open recipes.",
  BAD_KEY: "Google didn't accept that key. Check it in settings.",
  QUOTA: "Gemini's limit is reached for now. Try again in a minute.",
  TIMEOUT: "Gemini took too long. Try again.",
  NETWORK: "Couldn't reach Google. Check your connection.",
  BLOCKED: "Gemini declined this one.",
  PARSE: "Gemini's answer came back garbled. Try again.",
  NOT_FOUND: "Couldn't open that page or video. It may be private, paywalled or gone.",
  NOT_RECIPE: "That doesn't look like a recipe.",
  NOT_CLASSIC: "That isn't a well-known dish, so Sous-Chef won't write it from scratch. Try a video or blog instead.",
  MODEL: "None of your Gemini models answered. Check the model names in Keys, or try again in a minute.",
  HTTP: "Gemini returned an error.",
};

export const errorMessage = err => (err instanceof AiError ? err.message : MESSAGES.HTTP);
export const errorDetail = err => (err instanceof AiError ? err.detail : String(err?.message || err || ""));

const cutoffDate = () => { const d = new Date(); d.setFullYear(d.getFullYear() - RECENT_YEARS); return d; };
const isGoogleRedirect = url => /vertexaisearch\.cloud\.google\.com|grounding-api-redirect/i.test(url || "");

// --------------------------------------------------------------------------
// Low-level calls
// --------------------------------------------------------------------------
// Models that failed this session: missing ones are skipped until reload,
// busy or rate-limited ones rest for a minute.
const modelBench = new Map();
const benched = m => { const until = modelBench.get(m); return until && until > Date.now(); };

async function callGemini(req) {
  const key = getKey();
  if (!key) throw new AiError("NO_KEY", MESSAGES.NO_KEY);
  const all = getModels();
  const order = [...all.filter(m => !benched(m)), ...all.filter(benched)];
  const tried = [];
  let lastErr = null;
  for (const model of order) {
    try {
      const out = await callModel(model, key, req);
      out.model = model;
      return out;
    } catch (err) {
      lastErr = err;
      tried.push(`${model}: ${err.detail || err.code}`);
      if (!err.retryNext) throw err; // e.g. bad key, blocked content: another model won't help
      modelBench.set(model, Date.now() + (err.code === "MODEL" ? 6 * 3600e3 : 60e3));
      console.warn(`Gemini model ${model} failed (${err.detail || err.code}); trying the next one.`);
    }
  }
  const quota = lastErr?.code === "QUOTA" || lastErr?.code === "TIMEOUT";
  throw new AiError(quota ? lastErr.code : "MODEL", quota ? MESSAGES[lastErr.code] : MESSAGES.MODEL, tried.join(" | "));
}

async function callModel(model, key, { parts, system, tools, schema, timeoutMs = 45000 }) {
  const generationConfig = { temperature: 0.3, maxOutputTokens: 8192 };
  if (/^gemini-2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }
  const body = { generationConfig, contents: [{ role: "user", parts }] };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools) body.tools = tools;

  const next = (code, message, detail) => Object.assign(new AiError(code, message, detail), { retryNext: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw next("TIMEOUT", MESSAGES.TIMEOUT, "timed out");
    throw new AiError("NETWORK", MESSAGES.NETWORK, String(err.message || err));
  }
  clearTimeout(timer);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const apiMsg = data?.error?.message || "";
    const raw = JSON.stringify(data);
    const detail = `HTTP ${response.status}${apiMsg ? ` · ${apiMsg.slice(0, 160)}` : ""}`;
    console.warn("Gemini error", model, detail, raw.slice(0, 800)); // never includes the key
    if (/API_KEY_INVALID|API key not valid|API_KEY_HTTP_REFERRER_BLOCKED|referer/i.test(raw) || response.status === 401) {
      throw new AiError("BAD_KEY", MESSAGES.BAD_KEY, detail);
    }
    if (response.status === 429) throw next("QUOTA", MESSAGES.QUOTA, detail);
    if (response.status === 404) throw next("MODEL", MESSAGES.MODEL, detail);
    if (response.status >= 500) throw next("HTTP", MESSAGES.HTTP, detail);
    // A model that doesn't support a feature (a tool, JSON mode, thinking settings): try another.
    if (response.status === 400 && /not supported|unsupported|not enabled|not available|tool|thinking|response_?schema|response_?mime/i.test(apiMsg)) {
      throw next("HTTP", MESSAGES.HTTP, detail);
    }
    if (response.status === 403) throw new AiError("BAD_KEY", MESSAGES.BAD_KEY, detail);
    throw new AiError("HTTP", MESSAGES.HTTP, detail);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  if (!candidate) throw new AiError("BLOCKED", MESSAGES.BLOCKED, data?.promptFeedback?.blockReason || "");
  const text = (candidate.content?.parts || []).map(p => p.text || "").join("").trim();
  if (!text) {
    if (candidate.finishReason === "SAFETY") throw new AiError("BLOCKED", MESSAGES.BLOCKED, "finishReason: SAFETY");
    throw next("PARSE", MESSAGES.PARSE, `finishReason: ${candidate.finishReason || "none"}`);
  }
  return { text, candidate };
}

function parseJson(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean); } catch { /* fall through */ }
  const start = clean.search(/[[{]/);
  const end = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch { /* fall through */ }
  }
  throw new AiError("PARSE", MESSAGES.PARSE, clean.slice(0, 200));
}

// YouTube Data API v3. Uses the YouTube key if set, otherwise the Gemini key
// (works when "YouTube Data API v3" is enabled for that key's project).
async function ytFetch(path, params) {
  const key = getYtKey() || getKey();
  if (!key) throw new AiError("NO_KEY", MESSAGES.NO_KEY);
  const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams(params)}`;
  let res;
  try {
    res = await fetch(url, { headers: { "x-goog-api-key": key } });
  } catch {
    // Some Google APIs reject the header on cross-site requests; fall back to the
    // documented key parameter for this read-only, public search.
    res = await fetch(`${url}&key=${encodeURIComponent(key)}`).catch(() => null);
  }
  if (!res) throw new AiError("NETWORK", MESSAGES.NETWORK);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || "";
    throw new AiError("YOUTUBE", "YouTube search isn't set up for this key.", `HTTP ${res.status} · ${reason} · ${data?.error?.message || ""}`);
  }
  return data;
}

// --------------------------------------------------------------------------
// Shared rules
// --------------------------------------------------------------------------
const PERSONA = "You are Web Sous-Chef, a careful kitchen assistant. You find and tidy up real recipes written by real cooks. You never invent new dishes.";

const FORMAT_RULES = `Formatting rules (follow exactly):
- Copy every amount, unit, time and temperature exactly as the source gives it. Never invent or adjust a number. If the source gives no amount, set amount to null.
- amount is a number (use 0.5 for "1/2"). For a range like "2-3", use the larger number.
- Rewrite each step in your own words: short, clear, one main action, at most 35 words. Do not copy the source's sentences.
- label is one or two words in capitals describing the action (PREP, SEAR, SIMMER, BAKE, SEASON...).
- timerSeconds: only when the source states a duration for that step (use the upper end of a range). Otherwise null.
- safety: when a step finishes cooking meat, fish, shellfish or an egg dish, set it to one of poultry, ground, whole, fish, shellfish, egg-dish. Otherwise null. Never write temperatures that are not in the source.
- group: an optional short heading for the ingredient (e.g. "Sauce"), or an empty string.
- title: the plain dish name, at most 6 words, no hype words or channel names.
- servings: the source's yield as a number, or null if not stated. minutes: total time as stated or a fair estimate from the steps.`;

const RECIPE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isRecipe: { type: "BOOLEAN" },
    title: { type: "STRING" },
    sourceName: { type: "STRING" },
    minutes: { type: "NUMBER", nullable: true },
    servings: { type: "NUMBER", nullable: true },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          amount: { type: "NUMBER", nullable: true },
          unit: { type: "STRING" },
          item: { type: "STRING" },
          group: { type: "STRING" },
        },
        required: ["amount", "unit", "item", "group"],
      },
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          text: { type: "STRING" },
          timerSeconds: { type: "NUMBER", nullable: true },
          videoTime: { type: "STRING", nullable: true },
          safety: { type: "STRING", nullable: true },
        },
        required: ["label", "text", "timerSeconds", "videoTime", "safety"],
      },
    },
  },
  required: ["isRecipe", "title", "sourceName", "minutes", "servings", "ingredients", "steps"],
};

const RECIPE_JSON_SHAPE = `{"isRecipe": true, "title": "", "sourceName": "", "minutes": 0, "servings": 0,
 "ingredients": [{"amount": 0, "unit": "", "item": "", "group": ""}],
 "steps": [{"label": "", "text": "", "timerSeconds": null, "videoTime": null, "safety": null}]}`;

const SAFETY_KEYS = ["poultry", "ground", "whole", "fish", "shellfish", "egg-dish"];
const num = v => (typeof v === "number" && Number.isFinite(v) ? v : (v != null && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null));
const strList = v => (Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : []);

function normalizeRecipe(raw, { kind, url, fallbackSource }) {
  if (!raw || raw.isRecipe === false) throw new AiError("NOT_RECIPE", MESSAGES.NOT_RECIPE);
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .filter(i => i && String(i.item || "").trim())
    .map(i => ({ amount: num(i.amount), unit: String(i.unit || "").trim(), item: String(i.item).trim(), group: String(i.group || "").trim() }));
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .filter(s => s && String(s.text || "").trim())
    .map(s => ({
      label: String(s.label || "STEP").trim().toUpperCase().slice(0, 20),
      text: String(s.text).trim(),
      timerSeconds: num(s.timerSeconds) && num(s.timerSeconds) > 0 ? Math.round(num(s.timerSeconds)) : null,
      videoSeconds: kind === "video" ? parseClock(s.videoTime) : null,
      safety: SAFETY_KEYS.includes(s.safety) ? s.safety : null,
    }));
  if (!ingredients.length || !steps.length) throw new AiError("NOT_RECIPE", MESSAGES.NOT_RECIPE);
  return {
    title: String(raw.title || "Untitled recipe").trim(),
    kind,
    minutes: num(raw.minutes),
    servings: num(raw.servings),
    source: kind === "classic" ? null : { name: String(raw.sourceName || fallbackSource || hostName(url) || "Original").trim(), url: url || "" },
    ingredients,
    steps,
  };
}

function contextLine({ fridge = [], avoid = [], pantry = true }) {
  const lines = [];
  if (fridge.length) lines.push(`The cook has only these ingredients: ${fridge.join(", ")}.`);
  if (pantry) lines.push("They also have basic pantry items: salt, pepper, cooking oil, sugar, soy sauce, water.");
  if (avoid.length) lines.push(`The cook will not eat: ${avoid.join(", ")} (allergy or dislike). Not even as a garnish or optional topping.`);
  return lines.join(" ");
}
// Hard rules for picking recipes from what the cook has.
function fitRule(q) {
  const rules = [];
  if (q.fridge?.length && !q.dish) rules.push("Only recipes made from the cook's ingredients plus pantry items. At most 2 small extras (like garlic, ginger or a spice); skip anything that needs another main ingredient.");
  if (q.avoid?.length) rules.push(`Exclude every recipe that uses ${q.avoid.join(", ")} in any form.`);
  return rules.join(" ");
}
const timeRule = max => (max ? `Only dishes that take ${max} minutes or less in total.` : "");

const PICK_FIELDS = {
  dish: { type: "STRING" },
  minutes: { type: "NUMBER", nullable: true },
  uses: { type: "ARRAY", items: { type: "STRING" } },
  needs: { type: "ARRAY", items: { type: "STRING" } },
  summary: { type: "STRING" },
  allergens: { type: "ARRAY", items: { type: "STRING" } },
  avoidHits: { type: "ARRAY", items: { type: "STRING" } },
};
const ALLERGENS = ["shellfish", "fish", "egg", "dairy", "wheat", "peanut", "tree nut", "soy", "sesame"];
const PICK_RULES = `For each pick:
- dish: the plain dish name, at most 6 words, no hype words or channel names.
- minutes: realistic total time for a home cook, prep included (most dishes take 10 minutes or more). Not the video length.
- uses: which of the cook's ingredients it uses. needs: main items they would still need (skip pantry items).
- summary: a short description of the dish itself, max 10 words, like a menu line. Never start with "This", "A video" or "In this".
- allergens: which of these the dish contains: ${ALLERGENS.join(", ")}. Empty if none.
- avoidHits: which of the cook's avoided items the dish uses. Should be empty, since those recipes are excluded.`;

function pickFields(p) {
  const m = num(p.minutes);
  return {
    minutes: m && m >= 3 ? Math.round(m) : null,
    uses: strList(p.uses), needs: strList(p.needs), summary: String(p.summary || "").trim(),
    allergens: strList(p.allergens).map(a => a.toLowerCase()).filter(a => ALLERGENS.includes(a)),
    avoidHits: strList(p.avoidHits),
  };
}

// --------------------------------------------------------------------------
// 1a. Videos: YouTube search, then Gemini picks the real recipe videos
// --------------------------------------------------------------------------
function isoDuration(text) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(text || "");
  return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : null;
}

async function findVideos(q) {
  const words = q.dish ? q.dish : q.fridge.slice(0, 4).join(" ");
  const minus = q.avoid.map(a => `-"${a}"`).join(" ");
  const search = await ytFetch("search", {
    part: "snippet", type: "video", maxResults: "20", q: `${words} recipe ${minus}`.trim(),
    publishedAfter: cutoffDate().toISOString().replace(/\.\d{3}Z$/, "Z"), videoEmbeddable: "true", safeSearch: "strict",
  });
  const ids = (search.items || []).map(i => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const details = await ytFetch("videos", { part: "contentDetails,snippet", id: ids.join(",") });
  const candidates = (details.items || []).map(v => ({
    id: v.id,
    title: v.snippet?.title || "",
    channel: v.snippet?.channelTitle || "",
    published: v.snippet?.publishedAt || "",
    seconds: isoDuration(v.contentDetails?.duration),
    thumb: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    description: (v.snippet?.description || "").slice(0, 300),
  })).filter(c => c.seconds == null || (c.seconds >= 60 && c.seconds <= 45 * 60));
  if (!candidates.length) return [];

  const prompt = `${contextLine(q)}
${q.dish ? `They want to cook: ${q.dish}.` : ""} ${timeRule(q.maxMinutes)}
Here are YouTube videos. Pick up to 3 that each teach one real recipe, best fit first. Skip compilations, vlogs, reviews and mukbangs. ${fitRule(q)} Returning fewer, or none, is better than a poor fit.
${PICK_RULES}
Videos:
${candidates.map(c => `- id ${c.id} | "${c.title}" | ${c.channel} | ${Math.round((c.seconds || 0) / 60)} min | ${c.description.replace(/\s+/g, " ")}`).join("\n")}`;
  const schema = {
    type: "OBJECT",
    properties: { picks: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, ...PICK_FIELDS }, required: ["id", "dish", "minutes", "uses", "needs", "summary", "allergens", "avoidHits"] } } },
    required: ["picks"],
  };
  const { text } = await callGemini({ parts: [{ text: prompt }], system: PERSONA, schema, timeoutMs: 40000 });
  const picks = parseJson(text).picks || [];
  return picks.map(p => {
    const c = candidates.find(x => x.id === p.id);
    if (!c) return null;
    return {
      kind: "video", title: String(p.dish || c.title).trim(), source: c.channel, url: `https://www.youtube.com/watch?v=${c.id}`,
      image: c.thumb, duration: c.seconds, published: c.published, ...pickFields(p),
    };
  }).filter(Boolean).slice(0, 3);
}

// --------------------------------------------------------------------------
// 1b. Blogs: Gemini + Google Search, then open each page for its real address
// --------------------------------------------------------------------------
async function findBlogs(q) {
  const year = cutoffDate().getFullYear();
  const target = q.dish ? `recipes for "${q.dish}"` : "dishes the cook can make from what they have";
  const prompt = `${contextLine(q)}
Use Google Search to find up to 5 recipe blog pages: ${target}. ${timeRule(q.maxMinutes)}
Only pages published or updated in ${year} or later. Each must be a single recipe on a cooking blog or recipe site (no lists, roundups, videos, social media or shops). Prefer established cooks. ${fitRule(q)}
Reply with JSON only, no other text: {"results":[{"url":"the link exactly as it appears in your search results","site":"site or author name"}]}`;
  const { text, candidate } = await callGemini({ parts: [{ text: prompt }], system: PERSONA, tools: [{ google_search: {} }], timeoutMs: 60000 });
  let found = [];
  try { found = (parseJson(text).results || []).filter(r => isUrl(r?.url)); } catch { found = []; }
  // Also take the cited sources Google attached to the answer.
  const chunks = (candidate.groundingMetadata?.groundingChunks || []).map(c => c.web).filter(w => w?.uri);
  chunks.forEach(w => { if (!found.some(f => f.url === w.uri)) found.push({ url: w.uri, site: w.title || "" }); });
  found = found.filter(f => !/youtube\.com|youtu\.be|instagram|tiktok|facebook|pinterest|xiaohongshu/i.test(`${f.url} ${f.site}`)).slice(0, 6);
  if (!found.length) return [];
  return resolveBlogs(found, q);
}

async function resolveBlogs(found, q) {
  const prompt = `${contextLine(q)}
Open each link below (some are Google redirect links that lead to the real page). For each page, report:
- index: the number shown before the link
- finalUrl: the page's real address, from its canonical link or og:url. Never a vertexaisearch.cloud.google.com address.
- site: the blog or site name
- image: the page's main photo URL (og:image), absolute, or ""
- published: the recipe's publish or last-updated date as YYYY-MM-DD, or ""
- isRecipe: true only if the page is one single recipe with ingredients and steps
- fits: false if the recipe breaks this rule, true otherwise: ${fitRule(q) || "any recipe fits"}
${PICK_RULES}
Links:
${found.map((f, i) => `${i + 1}. ${f.url}`).join("\n")}
Reply with JSON only, no other text: {"pages":[{"index":1,"finalUrl":"","site":"","image":"","published":"","isRecipe":true,"fits":true,"dish":"","minutes":0,"uses":[],"needs":[],"summary":"","allergens":[],"avoidHits":[]}]}`;
  const { text, candidate } = await callGemini({ parts: [{ text: prompt }], system: PERSONA, tools: [{ url_context: {} }], timeoutMs: 75000 });
  const pages = parseJson(text).pages || [];
  const statuses = candidate.urlContextMetadata?.urlMetadata || [];
  const cutoff = cutoffDate();
  return pages.map(p => {
    const orig = found[Number(p.index) - 1];
    if (!orig || p.isRecipe === false || p.fits === false) return null;
    const url = isUrl(p.finalUrl) && !isGoogleRedirect(p.finalUrl) ? p.finalUrl.trim() : null;
    if (!url) return null; // couldn't learn the real address; skip rather than show a broken link
    const published = /^\d{4}-\d{2}-\d{2}/.test(p.published || "") ? p.published.slice(0, 10) : "";
    if (published && new Date(published) < cutoff) return null;
    return {
      kind: "blog", title: String(p.dish || "").trim() || hostName(url), source: String(p.site || orig.site || hostName(url)).trim(), url,
      image: isUrl(p.image) ? p.image.trim() : "", published, ...pickFields(p),
      fetched: statuses.length ? statuses.some(s => /SUCCESS/i.test(s.urlRetrievalStatus || "")) : true,
    };
  }).filter(Boolean)
    .filter((r, i, all) => all.findIndex(x => x.url === r.url) === i)
    .slice(0, 3);
}

// --------------------------------------------------------------------------
// 1c. Classics: well-known dishes only
// --------------------------------------------------------------------------
async function suggestClassics(q) {
  const target = q.dish ? `Only if "${q.dish}" is itself a well-known traditional dish, include it.` : "";
  const prompt = `${contextLine(q)}
Suggest up to 2 well-known, traditional, home-style dishes the cook could make. ${target} ${timeRule(q.maxMinutes)}
Only dishes with an established name that many cookbooks share (for example: oyakodon, shakshuka, kimchi fried rice, egg drop soup). Never invent a dish or a fusion. ${fitRule(q)} If nothing fits, return an empty list.
${PICK_RULES} Also give the cuisine.`;
  const schema = {
    type: "OBJECT",
    properties: { classics: { type: "ARRAY", items: { type: "OBJECT", properties: { cuisine: { type: "STRING" }, ...PICK_FIELDS }, required: ["dish", "cuisine", "minutes", "uses", "needs", "summary", "allergens", "avoidHits"] } } },
    required: ["classics"],
  };
  const { text } = await callGemini({ parts: [{ text: prompt }], system: PERSONA, schema, timeoutMs: 30000 });
  return (parseJson(text).classics || []).slice(0, 2).map(c => ({
    kind: "classic", title: String(c.dish).trim(), source: String(c.cuisine || "").trim(), url: "", image: "", ...pickFields(c),
  }));
}

/**
 * q = { fridge: string[], dish: string, avoid: string[], pantry: bool,
 *       maxMinutes: number|null, sources: { video, blog, classic } }
 * Returns { results (max 6), warnings }
 */
export async function findRecipes(q) {
  const jobs = {
    video: q.sources.video ? findVideos(q) : Promise.resolve([]),
    blog: q.sources.blog ? findBlogs(q) : Promise.resolve([]),
    classic: q.sources.classic ? suggestClassics(q) : Promise.resolve([]),
  };
  const keys = Object.keys(jobs);
  const settled = await Promise.allSettled(Object.values(jobs));
  const got = {};
  const warnings = [];
  const errors = [];
  settled.forEach((s, i) => {
    const k = keys[i];
    if (s.status === "fulfilled") { got[k] = s.value; return; }
    got[k] = [];
    errors.push(s.reason);
    console.warn(`${k} search failed:`, s.reason?.detail || s.reason);
    if (s.reason?.code === "YOUTUBE") warnings.push({ text: "Videos are off: YouTube search isn't set up for your key yet.", settings: true });
    else if (k === "blog") warnings.push({ text: "Blogs couldn't be searched this time." });
    else if (k === "video") warnings.push({ text: "Videos couldn't be searched this time." });
  });
  // Safety net: drop anything that still touches the avoid list or needs too much shopping.
  const avoidWords = q.avoid.map(a => a.toLowerCase());
  const strictFit = q.fridge.length && !q.dish;
  for (const k of keys) {
    got[k] = got[k]
      .filter(r => !r.avoidHits?.length)
      .filter(r => !avoidWords.some(a => `${r.title} ${r.needs.join(" ")}`.toLowerCase().includes(a)))
      .filter(r => !strictFit || r.needs.length <= 2)
      .sort((a, b) => a.needs.length - b.needs.length);
  }
  // Mix sources so the first row shows a bit of everything.
  const order = [["video", 0], ["blog", 0], ["classic", 0], ["video", 1], ["blog", 1], ["video", 2], ["blog", 2], ["classic", 1]];
  const results = order.map(([k, i]) => got[k][i]).filter(Boolean).slice(0, MAX_RESULTS);
  if (!results.length && errors.length) {
    const hard = errors.find(e => e?.code && e.code !== "YOUTUBE") || errors[0];
    throw hard;
  }
  return { results, warnings };
}

// --------------------------------------------------------------------------
// 2. Turn a source into a Sous-Chef recipe
// --------------------------------------------------------------------------
async function fromVideo(url, q) {
  const prompt = `${contextLine(q)}
Watch this cooking video and write down its recipe. Ingredients and amounts must come from what the cook says or shows. For each step, set videoTime to the moment it starts in the video (m:ss).
If the video is not a recipe, set isRecipe to false.
${FORMAT_RULES}`;
  const { text } = await callGemini({ parts: [{ fileData: { fileUri: url } }, { text: prompt }], system: PERSONA, schema: RECIPE_SCHEMA, timeoutMs: 120000 });
  return normalizeRecipe(parseJson(text), { kind: "video", url });
}

async function fromPage(url, q) {
  const prompt = `${contextLine(q)}
Read this recipe page: ${url}
Write down its recipe. Most recipe pages include structured recipe data; prefer it when present. If the page is not a single recipe, set isRecipe to false.
${FORMAT_RULES}
Reply with JSON only, no other text, in this shape:
${RECIPE_JSON_SHAPE}`;
  const { text, candidate } = await callGemini({ parts: [{ text: prompt }], system: PERSONA, tools: [{ url_context: {} }], timeoutMs: 75000 });
  const statuses = candidate.urlContextMetadata?.urlMetadata || [];
  if (statuses.length && statuses.every(s => !/SUCCESS/i.test(s.urlRetrievalStatus || ""))) {
    throw new AiError("NOT_FOUND", MESSAGES.NOT_FOUND, statuses.map(s => s.urlRetrievalStatus).join(", "));
  }
  return normalizeRecipe(parseJson(text), { kind: "blog", url });
}

async function fromClassic(title, q) {
  const prompt = `${contextLine(q)}
Write the standard home-style recipe for "${title}".
First decide: is "${title}" a well-known, traditional dish with an established name? If not, set isRecipe to false and stop. Do not invent or fuse dishes.
Use the classic, widely published proportions. Keep it to common ingredients.
${FORMAT_RULES}`;
  const { text } = await callGemini({ parts: [{ text: prompt }], system: PERSONA, schema: RECIPE_SCHEMA, timeoutMs: 45000 });
  const raw = parseJson(text);
  if (raw?.isRecipe === false) throw new AiError("NOT_CLASSIC", MESSAGES.NOT_CLASSIC);
  return normalizeRecipe(raw, { kind: "classic" });
}

/** Pasted text and/or a screenshot (e.g. a RedNote post). image = { mimeType, base64 } */
export async function fromPaste({ text, image, sourceName }, q = {}) {
  const parts = [];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
  const prompt = `${contextLine(q)}
Here is a recipe post the cook copied${image ? " (screenshot attached)" : ""}. Write down its recipe.
${text ? `Post text:\n"""${text.slice(0, 12000)}"""` : ""}
If it is not a recipe, set isRecipe to false.
${FORMAT_RULES}`;
  parts.push({ text: prompt });
  const { text: out } = await callGemini({ parts, system: PERSONA, schema: RECIPE_SCHEMA, timeoutMs: 60000 });
  return normalizeRecipe(parseJson(out), { kind: "paste", url: "", fallbackSource: sourceName || "Pasted post" });
}

/** item = a search result, or { url } for a pasted link. */
export async function loadRecipe(item, q = {}) {
  if (item.kind === "classic") return fromClassic(item.title, q);
  if (youtubeId(item.url)) return fromVideo(item.url, q);
  return fromPage(item.url, q);
}
