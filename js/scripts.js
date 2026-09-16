// ==========================================================================
// Web Sous-Chef: Core Kitchen Utilities & Dock Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
	// --------------------------------------------------------------------------
	// 1. Homepage Thought Bubble Delay
	// --------------------------------------------------------------------------
	const bubble = document.querySelector('.thought-bubble');
	if (bubble) {
		setTimeout(() => {
			bubble.src = 'src/images/thought-bubble-2.svg';
		}, 2000);
	}

	// --------------------------------------------------------------------------
	// 2. Persistent Floating Kitchen Dock Setup
	// --------------------------------------------------------------------------
	const dock = document.getElementById('kitchen-dock');
	if (!dock) return; // Exit cleanly on pages without the kitchen dock

	const byId = id => document.getElementById(id);
	const panel = byId('dock-panel');
	const toggleBtn = byId('dock-toggle-btn');
	const badge = byId('dock-timer-badge');
	const display = byId('dock-timer-display');
	const quickBtn = byId('dock-quick-timer');
	const popup = byId('dock-timer-popup');
	const overtimeEl = byId('dock-overtime');
	const alarm = document.querySelector('.timer-sound');

	// Toggle Drawer Open / Close
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

	// Close on Escape key
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !dock.classList.contains('collapsed')) {
			setExpanded(false);
		}
	});

	// Close when clicking outside of the dock
	document.addEventListener('click', (e) => {
		if (!dock.classList.contains('collapsed') && !dock.contains(e.target)) {
			setExpanded(false);
		}
	});

	// Tab Switching inside Dock
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

	// --------------------------------------------------------------------------
	// 3. Smart Timer / Count-Up Stopwatch Engine
	// --------------------------------------------------------------------------
	let remainingMs = 0;
	let deadline = null;
	let stopwatchStart = null;
	let ticker = null;
	let isStopwatch = false;

	function formatTime(totalSec) {
		totalSec = Math.max(0, Math.floor(totalSec));
		const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
		const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
		const secs = String(totalSec % 60).padStart(2, '0');
		return `${hrs}:${mins}:${secs}`;
	}

	function renderDisplay() {
		if (isStopwatch && stopwatchStart !== null) {
			const elapsed = Math.floor((Date.now() - stopwatchStart) / 1000);
			const str = `+${formatTime(elapsed)}`;
			if (display) display.textContent = str;
			if (badge) badge.textContent = str;
			if (quickBtn) {
				quickBtn.textContent = 'Ⅱ';
				quickBtn.setAttribute('aria-label', 'Pause stopwatch');
			}
			return;
		}

		const sec = Math.ceil(remainingMs / 1000);
		const str = formatTime(sec);
		if (display) display.textContent = str;
		if (badge) badge.textContent = str;
		if (quickBtn) {
			quickBtn.textContent = deadline !== null ? 'Ⅱ' : '▶';
			quickBtn.setAttribute('aria-label', deadline !== null ? 'Pause timer' : 'Start timer');
		}
	}

	function tick() {
		if (isStopwatch) {
			renderDisplay();
			return;
		}

		if (deadline !== null) {
			remainingMs = Math.max(0, deadline - Date.now());
			if (remainingMs === 0) {
				deadline = null;
				clearInterval(ticker);
				ticker = null;
				if (popup && !popup.open) popup.showModal();
				if (alarm) {
					try {
						alarm.currentTime = 0;
						alarm.play().catch(() => { });
					} catch { }
				}
			}
		}
		renderDisplay();
	}

	function ensureTicker() {
		if (!ticker) ticker = setInterval(tick, 250);
	}

	function startTimerOrStopwatch() {
		// If timer is at 00:00:00 and not running, start an active count-up stopwatch
		if (remainingMs <= 0 && deadline === null && !isStopwatch) {
			isStopwatch = true;
			stopwatchStart = Date.now();
			ensureTicker();
			renderDisplay();
			return;
		}

		if (isStopwatch) {
			stopwatchStart = Date.now();
			ensureTicker();
			renderDisplay();
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
			isStopwatch = false;
			stopwatchStart = null;
			clearInterval(ticker);
			ticker = null;
			renderDisplay();
			return;
		}

		if (deadline !== null) {
			deadline = null;
			clearInterval(ticker);
			ticker = null;
			renderDisplay();
		}
	}

	function resetTimer() {
		isStopwatch = false;
		stopwatchStart = null;
		deadline = null;
		remainingMs = 0;
		clearInterval(ticker);
		ticker = null;
		if (alarm) {
			alarm.pause();
			alarm.currentTime = 0;
		}
		if (popup && popup.open) popup.close();
		renderDisplay();
	}

	// Timer Controls
	byId('dock-start')?.addEventListener('click', startTimerOrStopwatch);
	byId('dock-pause')?.addEventListener('click', pauseTimer);
	byId('dock-reset')?.addEventListener('click', resetTimer);
	byId('dock-done')?.addEventListener('click', resetTimer);

	quickBtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		if (deadline !== null || isStopwatch) pauseTimer();
		else startTimerOrStopwatch();
	});

	// Preset Buttons (+1m, +5m, +10m) switch to count-down
	dock.querySelectorAll('[data-add-seconds]').forEach(btn => {
		btn.addEventListener('click', () => {
			isStopwatch = false;
			stopwatchStart = null;
			const addSec = Number(btn.dataset.addSeconds);
			remainingMs += addSec * 1000;
			if (deadline !== null) deadline += addSec * 1000;
			renderDisplay();
		});
	});

	// --------------------------------------------------------------------------
	// 4. Temperature Converter (C/F with Hot/Cold Thermometer)
	// --------------------------------------------------------------------------
	const cInput = byId('dock-celsius');
	const fInput = byId('dock-fahrenheit');
	const thermoIcon = byId('dock-thermometer');

	function convertTemp(source, target, isToF) {
		const val = source.value.trim();
		if (!val || isNaN(val)) {
			target.value = '';
			return;
		}
		const num = parseFloat(val);
		const res = isToF ? (num * 9 / 5) + 32 : (num - 32) * 5 / 9;
		target.value = res.toFixed(1);
		if (thermoIcon) {
			const isBoiling = (isToF ? num : res) >= 100;
			thermoIcon.src = isBoiling ? 'src/images/thermometer_hot.svg' : 'src/images/thermometer_cold.svg';
		}
	}

	cInput?.addEventListener('input', () => convertTemp(cInput, fInput, true));
	fInput?.addEventListener('input', () => convertTemp(fInput, cInput, false));

	// --------------------------------------------------------------------------
	// 5. Volume Converter (Fraction-Aware: 1/2, 1 1/2, Decimals)
	// --------------------------------------------------------------------------
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
		targetInput.value = res.toFixed(2);
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