import * as fs from "node:fs";
import * as path from "node:path";

function createWavHeader(sampleCount, sampleRate = 44100, channels = 1, bitsPerSample = 16) {
	const byteRate = (sampleRate * channels * bitsPerSample) / 8;
	const blockAlign = (channels * bitsPerSample) / 8;
	const dataSize = sampleCount * channels * (bitsPerSample / 8);
	const buffer = Buffer.alloc(44);

	// "RIFF" chunk
	buffer.write("RIFF", 0);
	buffer.writeUInt32LE(36 + dataSize, 4);
	buffer.write("WAVE", 8);

	// "fmt " subchunk
	buffer.write("fmt ", 12);
	buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
	buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
	buffer.writeUInt16LE(channels, 22);
	buffer.writeUInt32LE(sampleRate, 24);
	buffer.writeUInt32LE(byteRate, 28);
	buffer.writeUInt16LE(blockAlign, 32);
	buffer.writeUInt16LE(bitsPerSample, 34);

	// "data" subchunk
	buffer.write("data", 36);
	buffer.writeUInt32LE(dataSize, 40);

	return buffer;
}

function generateAlarmWave() {
	const sampleRate = 44100;
	const durationSeconds = 3.2;
	const totalSamples = Math.floor(sampleRate * durationSeconds);
	const buffer = Buffer.alloc(totalSamples * 2);

	// Alarm structure: Two repeating cycles of a 3-tone energetic alarm burst followed by a ringing chime
	// Cycle 1: 0.0s to 1.4s (Pulse 1, Pulse 2, Pulse 3)
	// Cycle 2: 1.5s to 3.0s (Pulse 4, Pulse 5, Pulse 6 + Harmonic ring)
	const pulses = [
		{ start: 0.0, end: 0.18, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 0.22, end: 0.4, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 0.44, end: 0.75, freq1: 1046.5, freq2: 1568, type: "triangle" },

		{ start: 1.1, end: 1.28, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 1.32, end: 1.5, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 1.54, end: 1.95, freq1: 1174.66, freq2: 1760, type: "triangle" },

		// Final resonant chime ringing out
		{ start: 2.1, end: 3.1, freq1: 1046.5, freq2: 2093, type: "sine" },
	];

	for (let i = 0; i < totalSamples; i++) {
		const t = i / sampleRate;
		let sampleValue = 0;

		for (const p of pulses) {
			if (t >= p.start && t <= p.end) {
				const localT = t - p.start;
				const pulseDuration = p.end - p.start;

				// Envelope: Fast attack (0.015s), sustain, exponential decay
				let env = 1.0;
				if (localT < 0.015) {
					env = localT / 0.015;
				} else {
					env = Math.exp((-4 * (localT - 0.015)) / pulseDuration);
				}

				// Dual-frequency rich alarm harmonic tone
				const w1 = 2 * Math.PI * p.freq1 * localT;
				const w2 = 2 * Math.PI * p.freq2 * localT;

				let tone = 0.65 * Math.sin(w1) + 0.35 * Math.sin(w2);
				if (p.type === "triangle") {
					// Add high-order harmonic for punch
					tone += 0.2 * Math.sin(w1 * 2);
				}

				sampleValue += tone * env;
			}
		}

		// Hard limiter / normalization to maximize loudness without clipping
		const clamped = Math.max(-0.95, Math.min(0.95, sampleValue));
		const pcm16 = Math.floor(clamped * 32767);
		buffer.writeInt16LE(pcm16, i * 2);
	}

	const header = createWavHeader(totalSamples, sampleRate, 1, 16);
	return Buffer.concat([header, buffer]);
}

const wavData = generateAlarmWave();

const targetDirs = [
	path.resolve("android-app/android/app/src/main/res/raw"),
	path.resolve("web-app/public/sounds"),
	path.resolve("android-app/out/sounds"),
];

for (const dir of targetDirs) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	const targetFile = path.join(dir, "daypulse_alarm.wav");
	fs.writeFileSync(targetFile, wavData);
	console.log(`Generated: ${targetFile} (${(wavData.length / 1024).toFixed(1)} KB)`);
}
