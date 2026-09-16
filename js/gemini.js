// ==========================================================================
// Web Sous-Chef: Token-Optimized Gemini Engine & Split View Controller
// ==========================================================================

const KEY_STORAGE = "souschef_gemini_key";
const CACHE_PREFIX = "souschef_recipe_";

// 1. Minimized JSON Schema to prevent verbose field hallucinations
const recipeSchema = {
    type: "OBJECT",
    properties: {
        title: { type: "STRING" },
        cuisine: { type: "STRING" },
        prepTime: { type: "STRING" },
        servings: { type: "INTEGER" },
        ingredients: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    item: { type: "STRING" },
                    amount: { type: "STRING" },
                    unit: { type: "STRING" }
                }
            }
        },
        steps: { type: "ARRAY", items: { type: "STRING" } },
        youtubeQuery: { type: "STRING" }
    },
    required: ["title", "cuisine", "prepTime", "servings", "ingredients", "steps", "youtubeQuery"]
};

let currentRecipeSteps = [];
let currentStepIndex = 0;

async function askGemini(ingredients, apiKey, cuisine = "All", diet = "Any") {
    // Session Caching: Avoids duplicate API hits if the user re-enters the same query
    const cacheKey = `${CACHE_PREFIX}${ingredients.trim().toLowerCase()}_${cuisine}_${diet}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch {
            sessionStorage.removeItem(cacheKey);
        }
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            generationConfig: {
                temperature: 0.4,           // Lower temperature prevents meandering, verbose prose
                maxOutputTokens: 750,       // Hard limit: A standard recipe needs < 500 tokens
                responseMimeType: "application/json",
                responseSchema: recipeSchema
            },
            systemInstruction: {
                parts: [{
                    text: "You are Web Sous-Chef. Generate authentic recipes matching tags. Write concise, actionable instructions. Never output pleasantries or commentary."
                }]
            },
            contents: [{
                role: "user",
                parts: [{ text: `Ingredients: ${ingredients}. Cuisine: ${cuisine}. Diet: ${diet}.` }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`Google Gemini error (${response.status}). Check your API key or quota.`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini returned an empty recipe. Try different ingredients.");

    const parsed = JSON.parse(rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));

    // Save valid response to session cache
    try {
        sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
    } catch {
        // Handle storage quota limits gracefully
    }

    return parsed;
}

function renderRecipeCard(targetArea, recipe) {
    currentRecipeSteps = recipe.steps || [];
    currentStepIndex = 0;

    const card = document.createElement("article");
    card.className = "recipe-card";

    // Header
    const header = document.createElement("header");
    header.className = "recipe-header";
    header.innerHTML = `
        <h2>${recipe.title}</h2>
        <div class="recipe-metadata">
            <span class="cuisine-badge">${recipe.cuisine}</span>
            <span>Prep: ${recipe.prepTime}</span>
            <span>Servings: ${recipe.servings}</span>
        </div>
    `;

    // Action Bar
    const actions = document.createElement("div");
    actions.className = "recipe-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-recipe-button";
    copyBtn.textContent = "Copy Recipe";

    const formattedText = `${recipe.title}\nCuisine: ${recipe.cuisine} | Prep: ${recipe.prepTime}\n\nIngredients:\n${recipe.ingredients.map(i => `• ${i.amount || ''} ${i.unit || ''} ${i.item}`).join('\n')}\n\nSteps:\n${recipe.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}`;

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

    // Ingredients
    const ingTitle = document.createElement("h3");
    ingTitle.textContent = "Ingredients";
    const ingList = document.createElement("dl");
    ingList.className = "ingredients-grid";
    recipe.ingredients.forEach(i => {
        const dt = document.createElement("dt");
        dt.textContent = `${i.amount || ''} ${i.unit || ''}`;
        const dd = document.createElement("dd");
        dd.textContent = i.item;
        ingList.append(dt, dd);
    });

    // Steps Checklist
    const stepTitle = document.createElement("h3");
    stepTitle.textContent = "Directions";
    const stepList = document.createElement("ol");
    stepList.className = "recipe-steps";
    recipe.steps.forEach((step, idx) => {
        const li = document.createElement("li");
        li.className = "recipe-step";
        li.innerHTML = `
            <label>
                <input type="checkbox" aria-label="Step ${idx + 1}">
                <span><strong>${idx + 1}.</strong> ${step}</span>
            </label>
        `;
        li.querySelector("input").addEventListener("change", e => {
            li.classList.toggle("step-done", e.target.checked);
        });
        stepList.appendChild(li);
    });

    card.append(header, actions, ingTitle, ingList, stepTitle, stepList);
    targetArea.replaceChildren(card);
}

// Step-by-Step Cooking Modal Logic
function openFocusModal() {
    if (!currentRecipeSteps.length) return;
    const modal = document.getElementById("focus-steps-modal");
    currentStepIndex = 0;
    updateFocusModalContent();
    modal.showModal();
}

function updateFocusModalContent() {
    const counter = document.getElementById("focus-modal-step-counter");
    const text = document.getElementById("focus-modal-step-text");
    const prevBtn = document.getElementById("focus-prev-btn");
    const nextBtn = document.getElementById("focus-next-btn");

    counter.textContent = `STEP ${currentStepIndex + 1} OF ${currentRecipeSteps.length}`;
    text.textContent = currentRecipeSteps[currentStepIndex];

    prevBtn.disabled = currentStepIndex === 0;
    nextBtn.textContent = currentStepIndex === currentRecipeSteps.length - 1 ? "FINISH ✓" : "NEXT →";
}

document.addEventListener("DOMContentLoaded", () => {
    const input = document.querySelector(".user-input");
    const sendBtn = document.querySelector(".send-btn");
    const chatLog = document.querySelector(".chat-log");
    const recipeDisplayArea = document.getElementById("recipe-display-area");
    const modal = document.getElementById("api-modal");
    const keyInput = document.getElementById("gemini-key-input");
    const status = document.getElementById("api-status");

    const filterToggleBtn = document.getElementById("filter-toggle-btn");
    const filterDrawer = document.getElementById("filter-drawer");

    let activeCuisine = "All";
    let activeDiet = "Any";
    let isBusy = false;

    // Filter Drawer Toggle
    filterToggleBtn?.addEventListener("click", () => {
        const isCollapsed = filterDrawer.classList.toggle("collapsed");
        filterToggleBtn.textContent = isCollapsed ? "FILTERS ▾" : "FILTERS ▲";
    });

    // Filter Selection
    document.querySelectorAll(".filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const type = pill.dataset.type;
            if (type === "cuisine") activeCuisine = pill.dataset.val;
            else activeDiet = pill.dataset.val;

            document.querySelectorAll(`.filter-pill[data-type="${type}"]`).forEach(p => {
                const isSelected = p === pill;
                p.classList.toggle("active", isSelected);
            });
        });
    });

    // Focus Steps Navigation
    document.getElementById("close-focus-btn")?.addEventListener("click", () => {
        document.getElementById("focus-steps-modal")?.close();
    });
    document.getElementById("focus-prev-btn")?.addEventListener("click", () => {
        if (currentStepIndex > 0) {
            currentStepIndex--;
            updateFocusModalContent();
        }
    });
    document.getElementById("focus-next-btn")?.addEventListener("click", () => {
        if (currentStepIndex < currentRecipeSteps.length - 1) {
            currentStepIndex++;
            updateFocusModalContent();
        } else {
            document.getElementById("focus-steps-modal")?.close();
        }
    });

    // API Modal Handlers
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

    // Recipe Generation Trigger
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
        botMsg.textContent = "Sous-Chef is cooking...";
        chatLog.appendChild(botMsg);
        botMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });

        try {
            const recipe = await askGemini(text, apiKey, activeCuisine, activeDiet);
            botMsg.textContent = `✓ Created: ${recipe.title} (See right panel)`;
            renderRecipeCard(recipeDisplayArea, recipe);
        } catch (err) {
            botMsg.textContent = err.message || "Failed to generate recipe.";
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