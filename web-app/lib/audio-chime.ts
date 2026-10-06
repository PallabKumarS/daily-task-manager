let audioCtx: AudioContext | null = null;

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

export function playNotificationChime(): void {
	try {
		const ctx = getAudioContext();
		if (!ctx) return;

		const now = ctx.currentTime;

		const osc1 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = "sine";
		osc1.frequency.setValueAtTime(523.25, now); // C5
		gain1.gain.setValueAtTime(0.15, now);
		gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

		osc1.connect(gain1);
		gain1.connect(ctx.destination);

		osc1.start(now);
		osc1.stop(now + 0.35);

		const osc2 = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = "sine";
		osc2.frequency.setValueAtTime(783.99, now + 0.12); // G5
		gain2.gain.setValueAtTime(0.18, now + 0.12);
		gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

		osc2.connect(gain2);
		gain2.connect(ctx.destination);

		osc2.start(now + 0.12);
		osc2.stop(now + 0.55);
	} catch {
		// Audio playback error or autoplay policy
	}
}
