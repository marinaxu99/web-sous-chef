// ==========================================================================
// Web Sous-Chef: Precision Kitchen Utilities & Continuous Zen Chime Engine
// ==========================================================================

let audioCtx = null;
let alarmChimeInterval = null;

// Safe, unified AudioContext accessor with automatic unlock & resume
function getAudioContext() {
	if (!audioCtx) {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (AudioContextClass) {
			audioCtx = new AudioContextClass();
		}
	}
	if (audioCtx && audioCtx.state === 'suspended') {
		audioCtx.resume().catch(() => { });
	}
	return audioCtx;
}

// Automatically unlocks browser audio policies on the cook's very first interaction
['pointerdown', 'keydown', 'touchstart'].forEach(eventType => {
	window.addEventListener(eventType, () => {
		getAudioContext();
	}, { once: true, passive: true });
});

document.addEventListener('DOMContentLoaded', () => {
	// Thought bubble subtle animation on home screen
	const bubble = document.querySelector('.thought-bubble');
	if (bubble) {
		setTimeout(() => {
			bubble.src = 'src/images/thought-bubble-2.svg';
		}, 2000);
	}

	// Pure Web Audio API: Calm Dual-Tone Mallet Chime (Harmonic & Grounded)
	function playCalmTwoToneChime() {
		try {
			const ctx = getAudioContext();
			if (!ctx) return;

			const now = ctx.currentTime;

			// Two warm melodic pitches: D5 (587.33 Hz) -> A5 (880.00 Hz)
			const notes = [
				{ timeOffset: 0.00, fundamental: 587.33, gain: 0.35, decay: 1.8 },
				{ timeOffset: 0.18, fundamental: 880.00, gain: 0.28, decay: 2.2 }
			];

			notes.forEach(note => {
				const strikeTime = now + note.timeOffset;

				// Harmonics for a rich, warm mallet / chime body
				const partials = [
					{ mult: 1.0, gainScale: 1.00 }, // Fundamental
					{ mult: 2.0, gainScale: 0.35 }, // Octave overtone
					{ mult: 3.0, gainScale: 0.12 }  // Sparkle tone
				];

				partials.forEach(p => {
					const osc = ctx.createOscillator();
					const gainNode = ctx.createGain();

					osc.type = "sine";
					osc.frequency.setValueAtTime(note.fundamental * p.mult, strikeTime);

					// Gentle acoustic attack envelope (no harsh click)
					gainNode.gain.setValueAtTime(0.0001, strikeTime);
					gainNode.gain.exponentialRampToValueAtTime(note.gain * p.gainScale, strikeTime + 0.02);
					gainNode.gain.exponentialRampToValueAtTime(0.0001, strikeTime + note.decay);

					osc.connect(gainNode);
					gainNode.connect(ctx.destination);

					osc.start(strikeTime);
					osc.stop(strikeTime + note.decay);
				});
			});
		} catch (err) {
			console.warn("Audio strike suppressed:", err);
		}
	}

	// Expose test helper to console
	window.testSousChefChime = playCalmTwoToneChime;

	function startRecurringAlarm() {
		playCalmTwoToneChime();
		if (alarmChimeInterval) clearInterval(alarmChimeInterval);
		// Consistent 2.5s cadence: audible & noticeable without panic
		alarmChimeInterval = setInterval(playCalmTwoToneChime, 2500);
	}

	function stopRecurringAlarm() {
		if (alarmChimeInterval) {
			clearInterval(alarmChimeInterval);
			alarmChimeInterval = null;
		}
	}

	// Rolling visual animation for numeric converters
	const activeAnimations = new WeakMap();

	function animateNumberChange(inputElement, targetValue, decimals = 1, duration = 380) {
		if (!inputElement) return;

		if (activeAnimations.has(inputElement)) {
			cancelAnimationFrame(activeAnimations.get(inputElement));
		}

		const target = parseFloat(targetValue);
		if (isNaN(target)) {
			inputElement.value = '';
			return;
		}

		const start = parseFloat(inputElement.value) || 0;
		const startTime = performance.now();

		function step(currentTime) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const ease = 1 - Math.pow(1 - progress, 3);
			const current = start + (target - start) * ease;

			inputElement.value = current.toFixed(decimals);

			if (progress < 1) {
				activeAnimations.set(inputElement, requestAnimationFrame(step));
			} else {
				inputElement.value = target.toFixed(decimals);
				activeAnimations.delete(inputElement);
			}
		}

		activeAnimations.set(inputElement, requestAnimationFrame(step));
	}

	// Floating Kitchen Dock Setup
	const dock = document.getElementById('kitchen-dock');
	if (!dock) return;

	const byId = id => document.getElementById(id);
	const panel = byId('dock-panel');
	const toggleBtn = byId('dock-toggle-btn');
	const badge = byId('dock-timer-badge');
	const display = byId('dock-timer-display');
	const quickBtn = byId('dock-quick-timer');
	const quickRepeatBtn = byId('dock-quick-restart');
	const popup = byId('dock-timer-popup');
	const overtimeDisplay = byId('dock-overtime');

	function setExpanded(expanded) {
		dock.classList.toggle('collapsed', !expanded);
		if (panel) panel.inert = !expanded;
		if (toggleBtn) {
			toggleBtn.setAttribute('aria-expanded', String(expanded));
			toggleBtn.textContent = `🛠 KITCHEN TOOLS ${expanded ? '▼' : '▲'}`;
		}
	}

	toggleBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		setExpanded(dock.classList.contains('collapsed'));
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !dock.classList.contains('collapsed')) {
			setExpanded(false);
		}
	});

	document.addEventListener('click', (e) => {
		if (!dock.classList.contains('collapsed') && !dock.contains(e.target)) {
			setExpanded(false);
		}
	});

	const tabs = [...dock.querySelectorAll('[role="tab"]')];
	tabs.forEach(tab => {
		tab.addEventListener('click', (e) => {
			e.stopPropagation();
			tabs.forEach(t => {
				const active = t === tab;
				t.classList.toggle('active', active);
				t.setAttribute('aria-selected', String(active));
				const targetPanel = byId(t.getAttribute('aria-controls'));
				if (targetPanel) targetPanel.hidden = !active;
			});
		});
	});

	// Timer & Stopwatch State
	let remainingMs = 0;
	let initialCountdownPresetMs = 0;
	let deadline = null;
	let alarmTargetTimestamp = null;
	let isAlarmActive = false;

	let isStopwatch = false;
	let stopwatchElapsedMs = 0;
	let stopwatchStartTime = null;
	let isStopwatchRunning = false;

	let ticker = null;
	let timerRollAnimation = null;

	function formatTime(totalSec) {
		totalSec = Math.max(0, Math.floor(totalSec));
		const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
		const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
		const secs = String(totalSec % 60).padStart(2, '0');
		return `${hrs}:${mins}:${secs}`;
	}

	function setQuickButtonRunning(isRunning) {
		if (!quickBtn) return;
		const playIcon = quickBtn.querySelector('.icon-play');
		const pauseIcon = quickBtn.querySelector('.icon-pause');
		if (playIcon && pauseIcon) {
			playIcon.style.display = isRunning ? 'none' : 'block';
			pauseIcon.style.display = isRunning ? 'block' : 'none';
		}
		quickBtn.setAttribute('aria-label', isRunning ? 'Pause timer' : 'Start timer');
	}

	function renderDisplay(customSec = null) {
		if (customSec !== null) {
			const str = formatTime(customSec);
			if (display) display.textContent = str;
			if (badge) badge.textContent = str;
			return;
		}

		if (isStopwatch) {
			let currentSec = 0;
			if (isStopwatchRunning && stopwatchStartTime) {
				currentSec = Math.floor((stopwatchElapsedMs + (Date.now() - stopwatchStartTime)) / 1000);
			} else {
				currentSec = Math.floor(stopwatchElapsedMs / 1000);
			}
			const str = formatTime(currentSec);
			if (display) display.textContent = str;
			if (badge) badge.textContent = str;
			setQuickButtonRunning(isStopwatchRunning);
			return;
		}

		const sec = Math.ceil(remainingMs / 1000);
		const str = formatTime(sec);
		if (display) display.textContent = str;
		if (badge) badge.textContent = str;
		setQuickButtonRunning(deadline !== null);
	}

	function rollTimerNumbers(fromMs, toMs, duration = 400) {
		if (timerRollAnimation) cancelAnimationFrame(timerRollAnimation);
		const startSec = Math.ceil(fromMs / 1000);
		const targetSec = Math.ceil(toMs / 1000);
		const startTime = performance.now();

		function step(now) {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const ease = 1 - Math.pow(1 - progress, 3);
			const currentSec = Math.round(startSec + (targetSec - startSec) * ease);

			renderDisplay(currentSec);

			if (progress < 1) {
				timerRollAnimation = requestAnimationFrame(step);
			} else {
				renderDisplay();
				timerRollAnimation = null;
			}
		}

		timerRollAnimation = requestAnimationFrame(step);
	}

	function tick() {
		if (isStopwatch) {
			renderDisplay();
			return;
		}

		if (isAlarmActive && alarmTargetTimestamp) {
			const overtimeSec = Math.floor((Date.now() - alarmTargetTimestamp) / 1000);
			if (overtimeDisplay) overtimeDisplay.textContent = formatTime(overtimeSec);
			if (badge) badge.textContent = `+${formatTime(overtimeSec)}`;
			return;
		}

		if (deadline !== null) {
			remainingMs = Math.max(0, deadline - Date.now());
			if (remainingMs === 0) {
				deadline = null;
				isAlarmActive = true;
				alarmTargetTimestamp = Date.now();

				if (popup && !popup.open) {
					popup.showModal();
				}

				startRecurringAlarm();
			}
		}
		renderDisplay();
	}

	function ensureTicker() {
		if (!ticker) ticker = setInterval(tick, 250);
	}

	function startTimerOrStopwatch() {
		if (remainingMs <= 0 && deadline === null && !isStopwatch) {
			isStopwatch = true;
			isStopwatchRunning = true;
			stopwatchStartTime = Date.now();
			ensureTicker();
			renderDisplay();
			return;
		}

		if (isStopwatch) {
			if (!isStopwatchRunning) {
				isStopwatchRunning = true;
				stopwatchStartTime = Date.now();
				ensureTicker();
				renderDisplay();
			}
			return;
		}

		if (deadline === null && remainingMs > 0) {
			deadline = Date.now() + remainingMs;
			ensureTicker();
			renderDisplay();
		}
	}

	function pauseTimer() {
		if (isStopwatch) {
			if (isStopwatchRunning) {
				isStopwatchRunning = false;
				stopwatchElapsedMs += Date.now() - stopwatchStartTime;
				stopwatchStartTime = null;
				clearInterval(ticker);
				ticker = null;
				renderDisplay();
			}
			return;
		}

		if (deadline !== null) {
			remainingMs = Math.max(0, deadline - Date.now());
			deadline = null;
			clearInterval(ticker);
			ticker = null;
			renderDisplay();
		}
	}

	function repeatTimer() {
		dismissAlarm();
		if (isStopwatch) {
			const previousMs = stopwatchElapsedMs + (isStopwatchRunning && stopwatchStartTime ? (Date.now() - stopwatchStartTime) : 0);
			stopwatchElapsedMs = 0;
			stopwatchStartTime = Date.now();
			isStopwatchRunning = true;
			ensureTicker();
			rollTimerNumbers(previousMs, 0, 350);
			return;
		}

		if (initialCountdownPresetMs > 0) {
			const currentMs = remainingMs;
			clearInterval(ticker);
			ticker = null;
			remainingMs = initialCountdownPresetMs;
			deadline = Date.now() + remainingMs;
			ensureTicker();
			rollTimerNumbers(currentMs, initialCountdownPresetMs, 400);
		}
	}

	function dismissAlarm() {
		stopRecurringAlarm();
		isAlarmActive = false;
		alarmTargetTimestamp = null;
		if (popup && popup.open) popup.close();
		if (badge) badge.textContent = formatTime(0);
	}

	function clearTimer() {
		dismissAlarm();
		const previousMs = isStopwatch
			? (stopwatchElapsedMs + (isStopwatchRunning && stopwatchStartTime ? (Date.now() - stopwatchStartTime) : 0))
			: remainingMs;

		isStopwatch = false;
		isStopwatchRunning = false;
		stopwatchStartTime = null;
		stopwatchElapsedMs = 0;
		deadline = null;
		remainingMs = 0;
		initialCountdownPresetMs = 0;
		clearInterval(ticker);
		ticker = null;

		rollTimerNumbers(previousMs, 0, 350);
	}

	// Public hook for gemini.js step timer buttons
	window.setSousChefTimer = function (seconds) {
		dismissAlarm();
		const oldMs = isStopwatch ? 0 : remainingMs;
		isStopwatch = false;
		isStopwatchRunning = false;
		stopwatchStartTime = null;
		stopwatchElapsedMs = 0;

		remainingMs = seconds * 1000;
		initialCountdownPresetMs = remainingMs;
		deadline = Date.now() + remainingMs;

		ensureTicker();
		rollTimerNumbers(oldMs, remainingMs, 400);

		if (badge) {
			badge.style.transition = 'color 0.2s';
			badge.style.color = '#4ade80';
			setTimeout(() => { badge.style.color = ''; }, 1200);
		}
	};

	// Dock control listeners
	byId('dock-start')?.addEventListener('click', startTimerOrStopwatch);
	byId('dock-pause')?.addEventListener('click', pauseTimer);
	byId('dock-restart')?.addEventListener('click', repeatTimer);
	byId('dock-reset')?.addEventListener('click', clearTimer);
	byId('dock-done')?.addEventListener('click', clearTimer);

	quickBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		if (isAlarmActive) dismissAlarm();
		else if (deadline !== null || isStopwatchRunning) pauseTimer();
		else startTimerOrStopwatch();
	});

	quickRepeatBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		repeatTimer();
	});

	dock.querySelectorAll('[data-add-seconds]').forEach(btn => {
		btn.addEventListener('click', () => {
			dismissAlarm();
			const oldMs = isStopwatch ? 0 : remainingMs;
			isStopwatch = false;
			isStopwatchRunning = false;
			stopwatchStartTime = null;
			stopwatchElapsedMs = 0;

			const addSec = Number(btn.dataset.addSeconds);
			remainingMs += addSec * 1000;
			initialCountdownPresetMs = remainingMs;
			if (deadline !== null) deadline += addSec * 1000;

			rollTimerNumbers(oldMs, remainingMs, 400);
		});
	});

	// Temperature Converter
	const cInput = byId('dock-celsius');
	const fInput = byId('dock-fahrenheit');

	function convertTemp(source, target, isToF) {
		const val = source.value.trim();
		if (!val || isNaN(val)) {
			target.value = '';
			return;
		}
		const num = parseFloat(val);
		const res = isToF ? (num * 9 / 5) + 32 : (num - 32) * 5 / 9;
		animateNumberChange(target, res, 1);
	}

	cInput?.addEventListener('input', () => convertTemp(cInput, fInput, true));
	fInput?.addEventListener('input', () => convertTemp(fInput, cInput, false));

	// Volume Converter (Decimals & Fractions)
	const factors = { ml: 1, tbsp: 14.7868, cups: 236.588, tsp: 4.92892 };
	const units = { from: 'cups', to: 'ml' };
	let activeSide = 'from';

	function parseVol(str) {
		if (!str) return NaN;
		const trimmed = str.trim();
		const fractionMatch = trimmed.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
		if (fractionMatch) {
			const whole = Number(fractionMatch[1] || 0);
			const num = Number(fractionMatch[2]);
			const denom = Number(fractionMatch[3]);
			return denom === 0 ? NaN : whole + (num / denom);
		}
		return parseFloat(trimmed);
	}

	function convertVol() {
		const sourceInput = byId(`dock-volume-${activeSide}`);
		if (!sourceInput) return;
		const fromVal = parseVol(sourceInput.value);
		const targetSide = activeSide === 'from' ? 'to' : 'from';
		const targetInput = byId(`dock-volume-${targetSide}`);
		if (!targetInput) return;

		if (isNaN(fromVal)) {
			targetInput.value = '';
			return;
		}

		const inMl = fromVal * factors[units[activeSide]];
		const res = inMl / factors[units[targetSide]];
		animateNumberChange(targetInput, res, 2);
	}

	['from', 'to'].forEach(side => {
		byId(`dock-volume-${side}`)?.addEventListener('input', () => {
			activeSide = side;
			convertVol();
		});
	});

	dock.querySelectorAll('[data-volume-side]').forEach(btn => {
		btn.addEventListener('click', () => {
			const side = btn.dataset.volumeSide;
			units[side] = btn.dataset.unit;
			dock.querySelectorAll(`[data-volume-side="${side}"]`).forEach(b => {
				b.classList.toggle('active', b === btn);
			});
			const unitLabel = byId(`dock-${side}-unit`);
			if (unitLabel) unitLabel.textContent = btn.dataset.unit;
			convertVol();
		});
	});
});