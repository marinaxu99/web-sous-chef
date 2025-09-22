//to keep the module away from other javascript

//airecipe — using Google Generative AI API, added more functions with the help of GPT
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const API_KEY = "AIzaSyBHpi_Q87VSBgW81H6_96qrNlTmKQYRwWE";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

document.addEventListener("DOMContentLoaded", function () {
	const sendBtn = document.querySelector('.send-btn');
	const input = document.querySelector('.user-input');
	const chatLog = document.querySelector('.chat-log');

	input?.addEventListener('keypress', function (e) {
		if (e.key === 'Enter') sendBtn?.click();
	});

	if (sendBtn && input && chatLog) {
		sendBtn.addEventListener('click', async () => {
			const userText = input.value.trim();
			if (!userText) return;

			const userMsg = document.createElement("div");
			userMsg.classList.add("user-message");
			userMsg.textContent = userText;
			chatLog.appendChild(userMsg);

			input.value = "";

			const botMsg = document.createElement("div");
			botMsg.classList.add("bot-message", "loading");
			botMsg.innerHTML = `<em>thinking</em>`;
			chatLog.appendChild(botMsg);
			botMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });

			// Animated dots
			let dotCount = 0;
			const loadingInterval = setInterval(() => {
				dotCount = (dotCount + 1) % 4;
				botMsg.innerHTML = `<em>thinking${'.'.repeat(dotCount)}</em>`;
			}, 500);

			try {
				const prompt = `Generate a simple, fun recipe using only these ingredients: ${userText}. Return it in a clear format with:
1. A creative title
2. Type of dish
3. Step-by-step instructions
Format the instructions in bullet points. Make it easy to copy.`;

				const result = await model.generateContent(prompt);
				const response = await result.response.text();

				clearInterval(loadingInterval);
				botMsg.classList.remove("loading");

				const htmlResponse = response
					.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // bold
					.replace(/\n/g, "<br>"); // line breaks

				botMsg.innerHTML = `
					<div class="recipe-text">${htmlResponse}</div>
					<button class="copy-recipe-button">Copy Recipe</button>
				 `;

				const copyButton = botMsg.querySelector('.copy-recipe-button');
				const recipeText = botMsg.querySelector('.recipe-text');

				copyButton.addEventListener('click', () => {
					const textToCopy = recipeText.innerText;
					navigator.clipboard.writeText(textToCopy)
						.then(() => {
							copyButton.textContent = '✓ Copied!';
							setTimeout(() => {
								copyButton.textContent = 'Copy Recipe';
							}, 2000);
						})
						.catch(err => {
							console.error('Copy failed:', err);
							copyButton.textContent = '✗ Copy Failed';
						});
				});

				setTimeout(() => {
					botMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}, 50);
			} catch (err) {
				clearInterval(loadingInterval);
				console.error(err);
				botMsg.innerHTML = `<em>Something went wrong. Please try again.</em>`;
			}
		});
	}
});

//sound effects for buttons, helped by GPT
document.addEventListener("DOMContentLoaded", () => {
	const clickSound = document.querySelector(".button-sound");
	const clickables = document.querySelectorAll('button');

	if (clickSound) {
		clickables.forEach(el => {
			el.addEventListener('click', () => {
				try {
					clickSound.currentTime = 0; // rewind to start
					clickSound.play().catch(err => console.warn("Click sound blocked:", err));
				} catch (error) {
					console.warn("Error playing click sound:", error);
				}
			});
		});
	}
});

//to solve safari auto-zooming when typing into the user input, got from GPT
document.addEventListener('touchstart', function (event) {
	if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
		const viewport = document.querySelector('meta[name="viewport"]');
		if (viewport) {
			viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
		}
	}
}, false);

document.addEventListener('touchend', function (event) {
	const viewport = document.querySelector('meta[name="viewport"]');
	if (viewport) {
		viewport.setAttribute('content', 'width=device-width, initial-scale=1');
	}
}, false);
