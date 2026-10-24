let audioCtx: AudioContext | null = null;
let activeAlarmTimer: ReturnType<typeof setInterval> | null = null;
let activeAudioElement: HTMLAudioElement | null = null;
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

function playSynthesizedAlarmBurst(): void {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;

		const now = ctx.currentTime;

		// Pulse 1: Urgent 880Hz / 1320Hz dual harmonic tone
		const osc1 = ctx.createOscillator();
		const osc1b = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = "sine";
		osc1.frequency.setValueAtTime(880, now);
		osc1b.type = "triangle";
		osc1b.frequency.setValueAtTime(1320, now);
		gain1.gain.setValueAtTime(0.8, now);
		gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
		osc1.connect(gain1);
		osc1b.connect(gain1);
		gain1.connect(ctx.destination);
		osc1.start(now);
		osc1b.start(now);
		osc1.stop(now + 0.22);
		osc1b.stop(now + 0.22);

		// Pulse 2: Repeated punch
		const osc2 = ctx.createOscillator();
		const osc2b = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = "sine";
		osc2.frequency.setValueAtTime(880, now + 0.26);
		osc2b.type = "triangle";
		osc2b.frequency.setValueAtTime(1320, now + 0.26);
		gain2.gain.setValueAtTime(0.85, now + 0.26);
		gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
		osc2.connect(gain2);
		osc2b.connect(gain2);
		gain2.connect(ctx.destination);
		osc2.start(now + 0.26);
		osc2b.start(now + 0.26);
		osc2.stop(now + 0.5);
		osc2b.stop(now + 0.5);

		// Pulse 3: Resonant C6 chime flourish
		const osc3 = ctx.createOscillator();
		const gain3 = ctx.createGain();
		osc3.type = "triangle";
		osc3.frequency.setValueAtTime(1046.5, now + 0.55);
		gain3.gain.setValueAtTime(0.9, now + 0.55);
		gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
		osc3.connect(gain3);
		gain3.connect(ctx.destination);
		osc3.start(now + 0.55);
		osc3.stop(now + 1.2);
	} catch {
		// Ignore autoplay policy restriction
	}
}

function playSynthesizedTone(toneId = "alarm"): void {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;
		const now = ctx.currentTime;

		if (toneId === "radar") {
			// Double sonar ping
			const osc1 = ctx.createOscillator();
			const gain1 = ctx.createGain();
			osc1.type = "sine";
			osc1.frequency.setValueAtTime(1480, now);
			gain1.gain.setValueAtTime(0.8, now);
			gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
			osc1.connect(gain1);
			gain1.connect(ctx.destination);
			osc1.start(now);
			osc1.stop(now + 0.15);

			const osc2 = ctx.createOscillator();
			const gain2 = ctx.createGain();
			osc2.type = "sine";
			osc2.frequency.setValueAtTime(1760, now + 0.18);
			gain2.gain.setValueAtTime(0.85, now + 0.18);
			gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
			osc2.connect(gain2);
			gain2.connect(ctx.destination);
			osc2.start(now + 0.18);
			osc2.stop(now + 0.35);
			return;
		}

		if (toneId === "harmonic") {
			// Rich acoustic bell strike
			[523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = "sine";
				osc.frequency.setValueAtTime(freq, now + idx * 0.18);
				gain.gain.setValueAtTime(0.7 / (idx + 1), now + idx * 0.18);
				gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 1.2);
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start(now + idx * 0.18);
				osc.stop(now + idx * 0.18 + 1.2);
			});
			return;
		}

		if (toneId === "digital") {
			// Crisp watch double-beep
			[0, 0.12, 0.24, 0.36].forEach((startOffset) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = "square";
				osc.frequency.setValueAtTime(2048, now + startOffset);
				gain.gain.setValueAtTime(0.4, now + startOffset);
				gain.gain.setValueAtTime(0.01, now + startOffset + 0.08);
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start(now + startOffset);
				osc.stop(now + startOffset + 0.08);
			});
			return;
		}

		// Default Pulse Chime
		playSynthesizedAlarmBurst();
	} catch {
		// Ignore autoplay restriction
	}
}

export function playNotificationChime(toneId = "alarm"): void {
	if (typeof window === "undefined") return;

	const soundFile =
		toneId === "radar"
			? "daypulse_radar.wav"
			: toneId === "harmonic"
				? "daypulse_harmonic.wav"
				: toneId === "digital"
					? "daypulse_digital.wav"
					: "daypulse_alarm.wav";

	try {
		const audio = new Audio(`/sounds/${soundFile}`);
		audio.volume = 1.0;
		activeAudioElement = audio;
		const playPromise = audio.play();
		if (playPromise !== undefined) {
			playPromise.catch(() => {
				playSynthesizedTone(toneId);
			});
		}
	} catch {
		playSynthesizedTone(toneId);
	}
}

export interface StartAlarmOptions {
	ringCount?: number;
	intervalSeconds?: number;
	tone?: string;
	onTick?: (currentRing: number, maxRings: number) => void;
	onFinish?: () => void;
}

export function startAlarmRinging(options: StartAlarmOptions = {}): { stop: () => void } {
	stopCurrentAlarm();

	const count = options.ringCount !== undefined ? options.ringCount : 3;
	const intervalSec = Math.max(3, options.intervalSeconds || 10);
	const intervalMs = intervalSec * 1000;
	const isContinuous = count === 0;
	const maxRings = isContinuous ? 60 : count;
	const tone = options.tone || "alarm";

	isCurrentlyRinging = true;
	let ringsDone = 1;

	playNotificationChime(tone);
	options.onTick?.(1, maxRings);

	if (maxRings <= 1) {
		isCurrentlyRinging = false;
		options.onFinish?.();
		return { stop: stopCurrentAlarm };
	}

	activeAlarmTimer = setInterval(() => {
		ringsDone += 1;
		playNotificationChime(tone);
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
		if (activeAudioElement) {
			try {
				activeAudioElement.pause();
				activeAudioElement.currentTime = 0;
			} catch {}
			activeAudioElement = null;
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
	if (activeAudioElement) {
		try {
			activeAudioElement.pause();
			activeAudioElement.currentTime = 0;
		} catch {}
		activeAudioElement = null;
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
