// === gemini.js — drop-in ===
// Keep this module isolated from other JS.

// --- ENDPOINTS (no secrets in frontend) ---
const WORKER_URL = "https://souschef-proxy.marinaxu99.workers.dev/api/gemini";
const FALLBACK_URL = "https://souschef-gemini-fallback.vercel.app/api/gemini"; // <-- your Vercel function

async function askGeminiViaWorker(promptText) {
	// optional: random style nudge so repeats feel fresh
	const STYLES = ["Italian", "Mexican", "Thai", "Japanese", "French", "Greek", "Indian", "Korean", "Moroccan", "Vietnamese"];
	const style = STYLES[Math.floor(Math.random() * STYLES.length)];

	const body = {
		// sampling controls => more creativity/variation
		generationConfig: {
			temperature: 1.1,   // 0.7–1.3 are good creative ranges
			topP: 0.95,
			topK: 40,
			candidateCount: 1
		},
		contents: [{
			role: "user",
			parts: [{
				text: `${promptText}

Extra rules for variety:
- Give it a subtle ${style} twist.
- If asked again with the same ingredients, change seasoning, technique, or format (e.g., bowl, wrap, stir-fry, salad).
- Do NOT repeat the exact same recipe wording as a previous answer.`
			}]
		}]
	};

	let resp = await fetch(WORKER_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body)
	});

	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		const geoBlocked = resp.status === 400 && text.includes("User location is not supported");
		if (geoBlocked) {
			resp = await fetch(FALLBACK_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});
		} else {
			throw new Error(`Worker/API error ${resp.status}: ${text}`);
		}
	}

	const data = await resp.json();
	const parts = data?.candidates?.[0]?.content?.parts || [];
	return parts.map(p => p.text || "").join("\n").trim() || "(No text returned)";
}


// --- UI wiring ---
document.addEventListener("DOMContentLoaded", function () {
	const sendBtn = document.querySelector(".send-btn");
	const input = document.querySelector(".user-input");
	const chatLog = document.querySelector(".chat-log");

	// Enter key triggers send
	input?.addEventListener("keypress", (e) => {
		if (e.key === "Enter") sendBtn?.click();
	});

	if (sendBtn && input && chatLog) {
		sendBtn.addEventListener("click", async () => {
			const userText = input.value.trim();
			if (!userText) return;

			// add user bubble
			const userMsg = document.createElement("div");
			userMsg.classList.add("user-message");
			userMsg.textContent = userText;
			chatLog.appendChild(userMsg);
			input.value = "";

			// add bot placeholder
			const botMsg = document.createElement("div");
			botMsg.classList.add("bot-message", "loading");
			botMsg.innerHTML = `<em>thinking</em>`;
			chatLog.appendChild(botMsg);
			botMsg.scrollIntoView({ behavior: "smooth", block: "start" });

			// animated dots
			let dotCount = 0;
			const loadingInterval = setInterval(() => {
				dotCount = (dotCount + 1) % 4;
				botMsg.innerHTML = `<em>thinking${".".repeat(dotCount)}</em>`;
			}, 500);

			// prevent double-click spam
			sendBtn.disabled = true;

			try {
				const prompt = `Generate a simple, fun recipe using only these ingredients: ${userText}.
Return it in a clear format with:
1. A creative title
2. Type of dish
3. Step-by-step instructions
Format the instructions in bullet points. Make it easy to copy.`;

				const response = await askGeminiViaWorker(prompt);

				clearInterval(loadingInterval);
				botMsg.classList.remove("loading");

				const htmlResponse = response
					.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // bold
					.replace(/\n/g, "<br>");                          // line breaks

				botMsg.innerHTML = `
          <div class="recipe-text">${htmlResponse}</div>
          <button class="copy-recipe-button">Copy Recipe</button>
        `;

				const copyButton = botMsg.querySelector(".copy-recipe-button");
				const recipeText = botMsg.querySelector(".recipe-text");

				copyButton.addEventListener("click", () => {
					const textToCopy = recipeText.innerText;
					navigator.clipboard.writeText(textToCopy)
						.then(() => {
							copyButton.textContent = "✓ Copied!";
							setTimeout(() => { copyButton.textContent = "Copy Recipe"; }, 2000);
						})
						.catch(err => {
							console.error("Copy failed:", err);
							copyButton.textContent = "✗ Copy Failed";
						});
				});

				setTimeout(() => {
					botMsg.scrollIntoView({ behavior: "smooth", block: "start" });
				}, 50);
			} catch (err) {
				clearInterval(loadingInterval);
				console.error(err);
				botMsg.innerHTML = `<em>Something went wrong. Please try again.</em>`;
			} finally {
				sendBtn.disabled = false;
			}
		});
	}
});

// --- optional: button click sound ---
document.addEventListener("DOMContentLoaded", () => {
	const clickSound = document.querySelector(".button-sound");
	const clickables = document.querySelectorAll("button");
	if (clickSound) {
		clickables.forEach(el => {
			el.addEventListener("click", () => {
				try { clickSound.currentTime = 0; clickSound.play().catch(() => { }); } catch { }
			});
		});
	}
});

// --- iOS Safari zoom guard ---
document.addEventListener("touchstart", function (event) {
	if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
		const viewport = document.querySelector('meta[name="viewport"]');
		if (viewport) viewport.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1");
	}
}, false);
document.addEventListener("touchend", function () {
	const viewport = document.querySelector('meta[name="viewport"]');
	if (viewport) viewport.setAttribute("content", "width=device-width, initial-scale=1");
}, false);
