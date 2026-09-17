// ==========================================================================
// Web Sous-Chef: Fast, Token-Optimized Brainstorming & Recipe Engine (2.5 Flash)
// ==========================================================================

const KEY_STORAGE = "souschef_gemini_key";
const PITCH_CACHE_PREFIX = "souschef_pitch_";
const FULL_RECIPE_CACHE_PREFIX = "souschef_full_";

const FALLBACK_PITCHES = [
    {
        title: "Pantry Garlic Fried Rice (蒜香炒饭)",
        cuisine: "Chinese",
        prepTime: "12 mins",
        tagline: "Crisp, fragrant, and turns day-old rice into savory comfort food."
    },
    {
        title: "Classic Tomato Egg Stir-Fry (番茄炒蛋)",
        cuisine: "Chinese",
        prepTime: "15 mins",
        tagline: "Juicy, sweet-savory comfort classic. Perfect served over rice."
    },
    {
        title: "Quick Sesame Scallion Noodles (葱油拌面)",
        cuisine: "Asian",
        prepTime: "10 mins",
        tagline: "Hot aromatic scallion oil drizzled over chewy, soy-glazed noodles."
    }
];

const FALLBACK_RECIPES = {
    "Pantry Garlic Fried Rice (蒜香炒饭)": {
        title: "Pantry Garlic Fried Rice (蒜香炒饭)",
        cuisine: "Chinese",
        prepTime: "12 mins",
        servings: 2,
        ingredientGroups: [
            {
                groupName: "The Base",
                items: [
                    { amount: "2", unit: "bowls", item: "Cooked rice (preferably day-old)" },
                    { amount: "2", unit: "large", item: "Eggs, beaten" }
                ]
            },
            {
                groupName: "Aromatics & Sauce",
                items: [
                    { amount: "4", unit: "cloves", item: "Garlic, finely minced" },
                    { amount: "2", unit: "tbsp", item: "Soy sauce or butter" },
                    { amount: "2", unit: "stalks", item: "Scallions, thinly sliced" }
                ]
            }
        ],
        steps: [
            {
                action: "SCRAMBLE & SET",
                instruction: "Scramble beaten eggs in a hot oiled wok until 80% soft set, then remove.",
                timerMinutes: 2,
                chefTip: "Remove eggs while still slightly runny; they will finish cooking when tossed back with the rice."
            },
            {
                action: "CRISP THE GARLIC",
                instruction: "Add minced garlic to wok over medium heat until fragrant and golden.",
                timerMinutes: 1,
                chefTip: null
            },
            {
                action: "HIGH HEAT TOSS",
                instruction: "Toss in cooked rice, breaking up clumps with the back of your spatula over high heat.",
                timerMinutes: 3,
                chefTip: "Day-old chilled rice has less surface moisture, creating separate, bouncy grains."
            },
            {
                action: "GLAZE & FINISH",
                instruction: "Drizzle soy sauce along the wok edges, stir in scrambled eggs and sliced scallions, and toss vigorously.",
                timerMinutes: 1,
                chefTip: "Pouring soy sauce on the hot wok metal rather than directly on the rice caramelizes it instantly."
            }
        ],
        youtubeQuery: "garlic fried rice recipe tutorial"
    },
    "Classic Tomato Egg Stir-Fry (番茄炒蛋)": {
        title: "Classic Tomato Egg Stir-Fry (番茄炒蛋)",
        cuisine: "Chinese",
        prepTime: "15 mins",
        servings: 2,
        ingredientGroups: [
            {
                groupName: "The Base",
                items: [
                    { amount: "3", unit: "large", item: "Eggs" },
                    { amount: "2", unit: "medium", item: "Tomatoes, cut into wedges" }
                ]
            },
            {
                groupName: "Seasoning & Pan",
                items: [
                    { amount: "1", unit: "tbsp", item: "Cooking oil" },
                    { amount: "1", unit: "tsp", item: "Sugar" },
                    { amount: "1/2", unit: "tsp", item: "Salt" }
                ]
            }
        ],
        steps: [
            {
                action: "FLUFF THE EGGS",
                instruction: "Beat eggs with salt. Fry in hot oil until fluffy clouds form, then remove from pan.",
                timerMinutes: 2,
                chefTip: "High heat and generous oil make the eggs expand into silky layers."
            },
            {
                action: "SIMMER TOMATOES",
                instruction: "In the same pan, stir-fry tomato wedges with sugar until juicy and softened.",
                timerMinutes: 4,
                chefTip: "Sugar balances the sharp acid of cooked tomatoes."
            },
            {
                action: "FOLD & SERVE",
                instruction: "Return fluffy eggs to pan, tossing gently to absorb tomato juices, then serve immediately.",
                timerMinutes: 1,
                chefTip: null
            }
        ],
        youtubeQuery: "tomato egg stir fry recipe"
    },
    "Quick Sesame Scallion Noodles (葱油拌面)": {
        title: "Quick Sesame Scallion Noodles (葱油拌面)",
        cuisine: "Asian",
        prepTime: "10 mins",
        servings: 1,
        ingredientGroups: [
            {
                groupName: "Noodles & Oil",
                items: [
                    { amount: "1", unit: "bundle", item: "Dry or fresh wheat noodles" },
                    { amount: "3", unit: "stalks", item: "Scallions, cut into finger-length strips" },
                    { amount: "2", unit: "tbsp", item: "Cooking oil" }
                ]
            },
            {
                groupName: "Glaze",
                items: [
                    { amount: "1", unit: "tbsp", item: "Soy sauce" },
                    { amount: "1", unit: "tsp", item: "Toasted sesame oil" }
                ]
            }
        ],
        steps: [
            {
                action: "BOIL NOODLES",
                instruction: "Boil noodles according to package directions, drain thoroughly and place in a bowl.",
                timerMinutes: 4,
                chefTip: null
            },
            {
                action: "FRY SCALLION OIL",
                instruction: "Heat oil in small pan, fry scallions slowly over medium-low heat until crispy and amber-brown.",
                timerMinutes: 4,
                chefTip: "Do not rush with high heat—gentle frying infuses deep sweetness into the oil."
            },
            {
                action: "GLAZE & TOSS",
                instruction: "Pour hot scallion oil over noodles along with soy sauce and sesame oil. Toss vigorously until glossy.",
                timerMinutes: 1,
                chefTip: null
            }
        ],
        youtubeQuery: "scallion oil noodles recipe"
    }
};

const pitchesSchema = {
    type: "OBJECT",
    properties: {
        concepts: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    title: { type: "STRING" },
                    cuisine: { type: "STRING" },
                    prepTime: { type: "STRING" },
                    tagline: { type: "STRING" }
                },
                required: ["title", "cuisine", "prepTime", "tagline"]
            }
        }
    },
    required: ["concepts"]
};

const fullRecipeSchema = {
    type: "OBJECT",
    properties: {
        title: { type: "STRING" },
        cuisine: { type: "STRING" },
        prepTime: { type: "STRING" },
        servings: { type: "INTEGER" },
        ingredientGroups: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    groupName: { type: "STRING" },
                    items: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                amount: { type: "STRING" },
                                unit: { type: "STRING" },
                                item: { type: "STRING" }
                            },
                            required: ["amount", "unit", "item"]
                        }
                    }
                },
                required: ["groupName", "items"]
            }
        },
        steps: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    action: { type: "STRING" },
                    instruction: { type: "STRING" },
                    timerMinutes: { type: "INTEGER", nullable: true },
                    chefTip: { type: "STRING", nullable: true }
                },
                required: ["action", "instruction"]
            }
        },
        youtubeQuery: { type: "STRING" }
    },
    required: ["title", "cuisine", "prepTime", "servings", "ingredientGroups", "steps", "youtubeQuery"]
};

// Rich object array storing steps for focus mode
let richRecipeSteps = [];
let currentStepIndex = 0;

function safeParseJSON(rawText) {
    let clean = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
        return JSON.parse(clean);
    } catch {
        if (!clean.endsWith("}")) clean += '"}';
        try { return JSON.parse(clean); } catch { return null; }
    }
}

// --------------------------------------------------------------------------
// API Calls (gemini-2.5-flash with zero thinking tokens)
// --------------------------------------------------------------------------
async function askGeminiPitches(ingredients, apiKey, cuisine = "All", diet = "Any") {
    const cacheKey = `${PITCH_CACHE_PREFIX}${ingredients.trim().toLowerCase()}_${cuisine}_${diet}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        try { return JSON.parse(cached); } catch { sessionStorage.removeItem(cacheKey); }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 2048,
                    thinkingConfig: { thinkingBudget: 0 },
                    responseMimeType: "application/json",
                    responseSchema: pitchesSchema
                },
                systemInstruction: {
                    parts: [{
                        text: "You are Web Sous-Chef. Pitch exactly 3 distinct recipe ideas makeable entirely from user ingredients plus household basics (water, salt, black pepper, cooking oil, sugar, soy sauce). If a dish requires a major protein, vegetable, or grain not listed, DO NOT recommend it. Keep taglines to one punchy sentence."
                    }]
                },
                contents: [{
                    role: "user",
                    parts: [{ text: `Ingredients: ${ingredients}. Cuisine: ${cuisine}. Diet: ${diet}. Recommend 3 dishes makeable right now.` }]
                }]
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error("Gemini Pitch Rejection:", response.status, errData);
            throw new Error(`API HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("EMPTY_RESPONSE");

        const parsed = safeParseJSON(rawText);
        if (!parsed?.concepts || parsed.concepts.length === 0) {
            throw new Error("JSON_PARSE_FAILED");
        }

        try { sessionStorage.setItem(cacheKey, JSON.stringify(parsed.concepts)); } catch { }
        return parsed.concepts;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

async function askGeminiFullRecipe(title, ingredients, apiKey, cuisine, diet) {
    const cacheKey = `${FULL_RECIPE_CACHE_PREFIX}${title.trim().toLowerCase()}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        try { return JSON.parse(cached); } catch { sessionStorage.removeItem(cacheKey); }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 2500,
                    thinkingConfig: { thinkingBudget: 0 },
                    responseMimeType: "application/json",
                    responseSchema: fullRecipeSchema
                },
                systemInstruction: {
                    parts: [{
                        text: "You are Web Sous-Chef. Create a precise, home-cookable recipe for the user's selected dish using their available ingredients. Group ingredients cleanly by culinary role and write engaging sensory action steps with timers and pro tips."
                    }]
                },
                contents: [{
                    role: "user",
                    parts: [{ text: `Dish: ${title}. Available ingredients: ${ingredients}. Preferred cuisine: ${cuisine}. Diet: ${diet}. Output complete JSON.` }]
                }]
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error("Gemini Full Recipe Rejection:", response.status, errData);
            throw new Error(`API HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("EMPTY_RESPONSE");

        const parsed = safeParseJSON(rawText);
        if (!parsed) throw new Error("JSON_PARSE_FAILED");

        try { sessionStorage.setItem(cacheKey, JSON.stringify(parsed)); } catch { }
        return parsed;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

// --------------------------------------------------------------------------
// UI Renderers
// --------------------------------------------------------------------------
function renderPitches(botMsgElement, concepts, userIngredients, apiKey, activeCuisine, activeDiet, recipeDisplayArea) {
    botMsgElement.classList.remove("loading");
    botMsgElement.textContent = "Chef, here are 3 directions you can cook right now:";

    const container = document.createElement("div");
    container.className = "concepts-container";

    concepts.forEach(concept => {
        const card = document.createElement("div");
        card.className = "concept-card";

        card.innerHTML = `
            <div class="concept-card-header">
                <div class="concept-title">${concept.title}</div>
                <span class="concept-time">⏱ ${concept.prepTime}</span>
            </div>
            <p class="concept-tagline">${concept.tagline}</p>
        `;

        const cookBtn = document.createElement("button");
        cookBtn.type = "button";
        cookBtn.className = "cook-btn";
        cookBtn.textContent = "Cook This ➔";

        cookBtn.addEventListener("click", async () => {
            cookBtn.disabled = true;
            cookBtn.textContent = "Loading Recipe...";

            const workspace = document.querySelector(".kitchen-workspace");
            if (workspace) workspace.setAttribute("data-active-view", "recipe");
            document.getElementById("switch-to-recipe")?.classList.add("active");
            document.getElementById("switch-to-chat")?.classList.remove("active");

            recipeDisplayArea.innerHTML = `
                <div class="empty-recipe-state">
                    <p class="empty-title">PREPARING: ${concept.title.toUpperCase()}</p>
                    <p class="empty-sub">Sous-Chef is measuring ingredients and writing steps...</p>
                </div>
            `;

            try {
                let fullRecipe = FALLBACK_RECIPES[concept.title];
                if (!fullRecipe) {
                    fullRecipe = await askGeminiFullRecipe(concept.title, userIngredients, apiKey, activeCuisine, activeDiet);
                }
                renderRecipeCard(recipeDisplayArea, fullRecipe, false);
                cookBtn.textContent = "✓ Active on Right";
            } catch (err) {
                console.error("Full recipe fetch error:", err);
                const fallback = FALLBACK_RECIPES[Object.keys(FALLBACK_RECIPES)[0]];
                renderRecipeCard(recipeDisplayArea, fallback, true);
                cookBtn.textContent = "✓ Backup Loaded";
            }
        });

        card.appendChild(cookBtn);
        container.appendChild(card);
    });

    botMsgElement.appendChild(container);
}

function renderRecipeCard(targetArea, recipe, isFallback = false) {
    richRecipeSteps = (recipe.steps || []).map(s => {
        if (typeof s === 'string') return { action: "STEP", instruction: s, timerMinutes: null, chefTip: null };
        return s;
    });
    currentStepIndex = 0;

    const card = document.createElement("article");
    card.className = "recipe-card";

    const header = document.createElement("header");
    header.className = "recipe-header";
    header.innerHTML = `
        ${isFallback ? '<div class="fallback-badge">★ SOUS-CHEF BACKUP PANTRY SPECIAL</div>' : ''}
        <h2>${recipe.title}</h2>
        <div class="recipe-metadata">
            <span class="cuisine-badge">${recipe.cuisine}</span>
            <span>Prep: ${recipe.prepTime}</span>
            <span>Servings: ${recipe.servings}</span>
        </div>
    `;

    const actions = document.createElement("div");
    actions.className = "recipe-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-recipe-button";
    copyBtn.textContent = "Copy Recipe";

    let plainIngredients = "";
    (recipe.ingredientGroups || []).forEach(g => {
        plainIngredients += `\n[${g.groupName}]\n` + g.items.map(i => `• ${i.amount} ${i.unit} ${i.item}`).join('\n');
    });
    const formattedText = `${recipe.title}\nCuisine: ${recipe.cuisine} | Prep: ${recipe.prepTime}\n${plainIngredients}\n\nDirections:\n${richRecipeSteps.map((s, idx) => `${idx + 1}. ${s.action}: ${s.instruction}`).join('\n')}`;

    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(formattedText).then(() => {
            copyBtn.textContent = "✓ Copied!";
            setTimeout(() => { copyBtn.textContent = "Copy Recipe"; }, 2000);
        });
    });

    const ytLink = document.createElement("a");
    ytLink.className = "yt-search-btn";
    ytLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.youtubeQuery || recipe.title + " cooking tutorial")}`;
    ytLink.target = "_blank";
    ytLink.rel = "noopener";
    ytLink.textContent = "Watch on YouTube ↗";

    const focusBtn = document.createElement("button");
    focusBtn.type = "button";
    focusBtn.className = "focus-mode-btn";
    focusBtn.textContent = "Focus Steps ⤢";
    focusBtn.addEventListener("click", openFocusModal);

    actions.append(copyBtn, ytLink, focusBtn);

    // Grouped Spec-Sheet Ingredients
    const ingContainer = document.createElement("section");
    ingContainer.className = "recipe-spec-section";

    const ingTitle = document.createElement("h3");
    ingTitle.className = "spec-section-heading";
    ingTitle.textContent = "Ingredients";
    ingContainer.appendChild(ingTitle);

    const groups = recipe.ingredientGroups || [{ groupName: "All Ingredients", items: recipe.ingredients || [] }];
    groups.forEach(g => {
        const groupWrap = document.createElement("div");
        groupWrap.className = "ingredient-group-block";

        const groupHeader = document.createElement("h4");
        groupHeader.className = "ingredient-group-title";
        groupHeader.textContent = g.groupName;
        groupWrap.appendChild(groupHeader);

        const groupList = document.createElement("div");
        groupList.className = "spec-ingredients-list";

        g.items.forEach(i => {
            const row = document.createElement("div");
            row.className = "spec-ingredient-row";
            row.innerHTML = `
                <span class="spec-measure">${i.amount} ${i.unit}</span>
                <span class="spec-dots" aria-hidden="true"></span>
                <span class="spec-name">${i.item}</span>
            `;
            groupList.appendChild(row);
        });

        groupWrap.appendChild(groupList);
        ingContainer.appendChild(groupWrap);
    });

    // Action Steps with Inline Timers & Tips
    const stepContainer = document.createElement("section");
    stepContainer.className = "recipe-spec-section";

    const stepTitle = document.createElement("h3");
    stepTitle.className = "spec-section-heading";
    stepTitle.textContent = "Directions";
    stepContainer.appendChild(stepTitle);

    const stepList = document.createElement("ol");
    stepList.className = "interactive-steps-list";

    richRecipeSteps.forEach((stepObj, idx) => {
        const li = document.createElement("li");
        li.className = "interactive-step-card";

        let timerHTML = "";
        if (stepObj.timerMinutes && stepObj.timerMinutes > 0) {
            timerHTML = `<button type="button" class="inline-step-timer-btn" data-timer-mins="${stepObj.timerMinutes}">⏱ Set ${stepObj.timerMinutes}m Timer</button>`;
        }

        let tipHTML = "";
        if (stepObj.chefTip) {
            tipHTML = `<div class="chef-pro-tip"><strong>💡 Pro-Tip:</strong> ${stepObj.chefTip}</div>`;
        }

        li.innerHTML = `
            <div class="step-card-top">
                <label class="step-checkbox-wrap">
                    <input type="checkbox" aria-label="Mark step ${idx + 1} as done">
                    <span class="step-action-tag">${stepObj.action}</span>
                </label>
                ${timerHTML}
            </div>
            <p class="step-instruction-body">${stepObj.instruction}</p>
            ${tipHTML}
        `;

        li.querySelector("input").addEventListener("change", e => {
            li.classList.toggle("step-done", e.target.checked);
        });

        const timerBtn = li.querySelector(".inline-step-timer-btn");
        if (timerBtn) {
            timerBtn.addEventListener("click", () => {
                const mins = Number(timerBtn.dataset.timerMins);
                if (window.setSousChefTimer) {
                    window.setSousChefTimer(mins * 60);
                }
                timerBtn.textContent = `✓ ${mins}m Set in Dock`;
                timerBtn.classList.add("active");
                setTimeout(() => {
                    timerBtn.textContent = `⏱ Set ${mins}m Timer`;
                    timerBtn.classList.remove("active");
                }, 3000);
            });
        }

        stepList.appendChild(li);
    });

    stepContainer.appendChild(stepList);
    card.append(header, actions, ingContainer, stepContainer);
    targetArea.replaceChildren(card);
}

// --------------------------------------------------------------------------
// Upgraded Focus Modal Logic (Keyboard Flip, Tips & Progress Bar)
// --------------------------------------------------------------------------
function openFocusModal() {
    if (!richRecipeSteps.length) return;
    const modal = document.getElementById("focus-steps-modal");
    currentStepIndex = 0;
    updateFocusModalContent();
    if (modal && !modal.open) modal.showModal();
}

function updateFocusModalContent() {
    if (!richRecipeSteps.length) return;
    const step = richRecipeSteps[currentStepIndex];

    const counter = document.getElementById("focus-modal-step-counter");
    const actionBadge = document.getElementById("focus-modal-action-badge");
    const text = document.getElementById("focus-modal-step-text");
    const tipContainer = document.getElementById("focus-modal-tip-container");
    const tipText = document.getElementById("focus-modal-tip-text");
    const timerContainer = document.getElementById("focus-modal-timer-container");
    const timerBtn = document.getElementById("focus-step-timer-btn");
    const progressFill = document.getElementById("focus-progress-fill");
    const prevBtn = document.getElementById("focus-prev-btn");
    const nextBtn = document.getElementById("focus-next-btn");

    if (counter) counter.textContent = `STEP ${currentStepIndex + 1} OF ${richRecipeSteps.length}`;
    if (actionBadge) actionBadge.textContent = step.action || "COOK";
    if (text) text.textContent = step.instruction || step;

    // Progress line calculation
    if (progressFill) {
        const pct = ((currentStepIndex + 1) / richRecipeSteps.length) * 100;
        progressFill.style.width = `${pct}%`;
    }

    // Chef Tip
    if (tipContainer && tipText) {
        if (step.chefTip) {
            tipText.textContent = step.chefTip;
            tipContainer.hidden = false;
        } else {
            tipContainer.hidden = true;
        }
    }

    // Step Timer Hook
    if (timerContainer && timerBtn) {
        if (step.timerMinutes && step.timerMinutes > 0) {
            timerBtn.textContent = `⏱ Start ${step.timerMinutes}m Timer in Dock`;
            timerBtn.onclick = () => {
                if (window.setSousChefTimer) {
                    window.setSousChefTimer(step.timerMinutes * 60);
                }
                timerBtn.textContent = `✓ ${step.timerMinutes}m Running in Dock`;
                setTimeout(() => {
                    timerBtn.textContent = `⏱ Start ${step.timerMinutes}m Timer in Dock`;
                }, 3000);
            };
            timerContainer.hidden = false;
        } else {
            timerContainer.hidden = true;
        }
    }

    if (prevBtn) prevBtn.disabled = currentStepIndex === 0;
    if (nextBtn) nextBtn.textContent = currentStepIndex === richRecipeSteps.length - 1 ? "FINISH ✓" : "NEXT →";
}

// --------------------------------------------------------------------------
// Initialization & Events
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    const input = document.querySelector(".user-input");
    const sendBtn = document.querySelector(".send-btn");
    const chatLog = document.querySelector(".chat-log");
    const recipeDisplayArea = document.getElementById("recipe-display-area");
    const modal = document.getElementById("api-modal");
    const keyInput = document.getElementById("gemini-key-input");
    const status = document.getElementById("api-status");
    const robotDialogue = document.getElementById("robot-dialogue");
    const filterToggleBtn = document.getElementById("filter-toggle-btn");
    const filterDrawer = document.getElementById("filter-drawer");

    let activeCuisine = "All";
    let activeDiet = "Any";
    let isBusy = false;

    // Mobile Switcher
    const workspace = document.querySelector(".kitchen-workspace");
    const chatTabBtn = document.getElementById("switch-to-chat");
    const recipeTabBtn = document.getElementById("switch-to-recipe");

    function setMobileView(view) {
        if (!workspace) return;
        workspace.setAttribute("data-active-view", view);
        if (chatTabBtn && recipeTabBtn) {
            chatTabBtn.classList.toggle("active", view === "chat");
            recipeTabBtn.classList.toggle("active", view === "recipe");
            chatTabBtn.setAttribute("aria-selected", String(view === "chat"));
            recipeTabBtn.setAttribute("aria-selected", String(view === "recipe"));
        }
    }

    chatTabBtn?.addEventListener("click", () => setMobileView("chat"));
    recipeTabBtn?.addEventListener("click", () => setMobileView("recipe"));

    // Wake Lock
    const wakeBtn = document.getElementById("wake-lock-btn");
    let wakeLock = null;

    async function toggleWakeLock() {
        if (!navigator.wakeLock) return;
        try {
            if (wakeLock !== null) {
                await wakeLock.release();
                wakeLock = null;
                wakeBtn?.setAttribute("aria-pressed", "false");
                const label = wakeBtn?.querySelector(".wake-label");
                if (label) label.textContent = "Screen Always On: OFF";
            } else {
                wakeLock = await navigator.wakeLock.request("screen");
                wakeBtn?.setAttribute("aria-pressed", "true");
                const label = wakeBtn?.querySelector(".wake-label");
                if (label) label.textContent = "Screen Always On: ON";
                wakeLock.addEventListener("release", () => {
                    wakeLock = null;
                    wakeBtn?.setAttribute("aria-pressed", "false");
                });
            }
        } catch {
            wakeBtn?.setAttribute("aria-pressed", "false");
        }
    }
    wakeBtn?.addEventListener("click", toggleWakeLock);

    // Filters
    filterToggleBtn?.addEventListener("click", () => {
        const isCollapsed = filterDrawer.classList.toggle("collapsed");
        filterToggleBtn.textContent = isCollapsed ? "FILTERS ▾" : "FILTERS ▲";
    });

    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const type = pill.dataset.type;
            if (type === "cuisine") activeCuisine = pill.dataset.val;
            else activeDiet = pill.dataset.val;

            document.querySelectorAll(`.filter-pill[data-type="${type}"]`).forEach(p => {
                p.classList.toggle("active", p === pill);
            });
        });
    });

    // Focus Modal Controls & Keyboard Arrow Navigation
    const focusModal = document.getElementById("focus-steps-modal");
    document.getElementById("close-focus-btn")?.addEventListener("click", () => focusModal?.close());

    document.getElementById("focus-prev-btn")?.addEventListener("click", () => {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            updateFocusModalContent();
        }
    });

    document.getElementById("focus-next-btn")?.addEventListener("click", () => {
        if (currentStepIndex < richRecipeSteps.length - 1) {
            currentStepIndex++;
            updateFocusModalContent();
        } else {
            focusModal?.close();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (!focusModal || !focusModal.open) return;
        if (e.key === "ArrowRight") {
            if (currentStepIndex < richRecipeSteps.length - 1) {
                currentStepIndex++;
                updateFocusModalContent();
            }
        } else if (e.key === "ArrowLeft") {
            if (currentStepIndex > 0) {
                currentStepIndex--;
                updateFocusModalContent();
            }
        }
    });

    // API Key Dialog
    function openModal(msg = "") {
        if (!modal) return;
        if (status) status.textContent = msg;
        if (keyInput) keyInput.value = localStorage.getItem(KEY_STORAGE) || "";
        modal.showModal();
    }

    document.getElementById("api-settings-btn")?.addEventListener("click", () => openModal());
    document.getElementById("close-api-btn")?.addEventListener("click", () => modal?.close());

    document.getElementById("api-key-form")?.addEventListener("submit", e => {
        e.preventDefault();
        const val = keyInput.value.trim();
        if (val) {
            localStorage.setItem(KEY_STORAGE, val);
            modal.close();
            input?.focus();
        }
    });

    document.getElementById("clear-key-btn")?.addEventListener("click", () => {
        localStorage.removeItem(KEY_STORAGE);
        if (keyInput) keyInput.value = "";
        if (status) status.textContent = "API key cleared.";
    });

    async function submitIngredients() {
        const text = input.value.trim();
        if (!text || isBusy) return;

        const apiKey = localStorage.getItem(KEY_STORAGE);
        if (!apiKey) {
            openModal("Please save your Gemini API key to cook.");
            return;
        }

        isBusy = true;
        sendBtn.disabled = true;
        input.value = "";

        const userMsg = document.createElement("div");
        userMsg.className = "user-message";
        userMsg.textContent = text;
        chatLog.appendChild(userMsg);

        const botMsg = document.createElement("div");
        botMsg.className = "bot-message loading";
        botMsg.textContent = "Sous-Chef is checking what you can cook...";
        chatLog.appendChild(botMsg);
        botMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });

        try {
            const concepts = await askGeminiPitches(text, apiKey, activeCuisine, activeDiet);
            renderPitches(botMsg, concepts, text, apiKey, activeCuisine, activeDiet, recipeDisplayArea);
        } catch (err) {
            console.error("Gemini Pitch Error:", err);
            if (robotDialogue) robotDialogue.textContent = "Pantry ideas ready!";
            renderPitches(botMsg, FALLBACK_PITCHES, text, apiKey, activeCuisine, activeDiet, recipeDisplayArea);
        } finally {
            isBusy = false;
            sendBtn.disabled = false;
            botMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }

    sendBtn?.addEventListener("click", submitIngredients);
    input?.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            submitIngredients();
        }
    });
});