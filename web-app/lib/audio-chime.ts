let audioCtx: AudioContext | null = null;
let activeAlarmTimer: ReturnType<typeof setInterval> | null = null;
let activeStopCallback: (() => void) | null = null;
let isCurrentlyRinging = false;

function getAudioContext(): AudioContext | null {
	if (typeof window === "undefined") return null;
	const AudioContextClass =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextClass) return null;

	if (!audioCtx) {
		audioCtx = new AudioContextClass();
	}

	if (audioCtx.state === "suspended") {
		audioCtx.resume();
	}

	return audioCtx;
}

function playSingleChimeBurst(): void {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;

		const now = ctx.currentTime;

		// Harmonic 1: C5 fundamental
		const osc1 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = "sine";
		osc1.frequency.setValueAtTime(523.25, now);
		gain1.gain.setValueAtTime(0.2, now);
		gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
		osc1.connect(gain1);
		gain1.connect(ctx.destination);
		osc1.start(now);
		osc1.stop(now + 0.4);

		// Harmonic 2: G5 fifth
		const osc2 = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = "sine";
		osc2.frequency.setValueAtTime(783.99, now + 0.12);
		gain2.gain.setValueAtTime(0.25, now + 0.12);
		gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
		osc2.connect(gain2);
		gain2.connect(ctx.destination);
		osc2.start(now + 0.12);
		osc2.stop(now + 0.65);

		// Harmonic 3: C6 sparkling accent
		const osc3 = ctx.createOscillator();
		const gain3 = ctx.createGain();
		osc3.type = "triangle";
		osc3.frequency.setValueAtTime(1046.5, now + 0.25);
		gain3.gain.setValueAtTime(0.18, now + 0.25);
		gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
		osc3.connect(gain3);
		gain3.connect(ctx.destination);
		osc3.start(now + 0.25);
		osc3.stop(now + 0.85);
	} catch {
		// Ignore audio context autoplay restriction
	}
}

export function playNotificationChime(): void {
	playSingleChimeBurst();
}

export interface StartAlarmOptions {
	ringCount?: number;
	intervalSeconds?: number;
	onTick?: (currentRing: number, maxRings: number) => void;
	onFinish?: () => void;
}

export function startAlarmRinging(options: StartAlarmOptions = {}): { stop: () => void } {
	stopCurrentAlarm();

	const count = options.ringCount !== undefined ? options.ringCount : 3;
	const intervalSec = Math.max(2, options.intervalSeconds || 10);
	const intervalMs = intervalSec * 1000;
	const isContinuous = count === 0;
	const maxRings = isContinuous ? 60 : count;

	isCurrentlyRinging = true;
	let ringsDone = 1;

	// Initial ring
	playSingleChimeBurst();
	options.onTick?.(1, maxRings);

	if (maxRings <= 1) {
		isCurrentlyRinging = false;
		options.onFinish?.();
		return { stop: stopCurrentAlarm };
	}

	activeAlarmTimer = setInterval(() => {
		ringsDone += 1;
		playSingleChimeBurst();
		options.onTick?.(ringsDone, maxRings);

		if (!isContinuous && ringsDone >= maxRings) {
			stopCurrentAlarm();
			options.onFinish?.();
		}
	}, intervalMs);

	activeStopCallback = () => {
		if (activeAlarmTimer) {
			clearInterval(activeAlarmTimer);
			activeAlarmTimer = null;
		}
		isCurrentlyRinging = false;
		activeStopCallback = null;
	};

	return { stop: stopCurrentAlarm };
}

export function stopCurrentAlarm(): void {
	if (activeAlarmTimer) {
		clearInterval(activeAlarmTimer);
		activeAlarmTimer = null;
	}
	if (activeStopCallback) {
		activeStopCallback();
		activeStopCallback = null;
	}
	isCurrentlyRinging = false;

	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("daypulse:alarm-stopped"));
	}
}

export function isAlarmRinging(): boolean {
	return isCurrentlyRinging;
}
