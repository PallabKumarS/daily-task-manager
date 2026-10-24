import * as fs from "node:fs";
import * as path from "node:path";

function createWavHeader(sampleCount, sampleRate = 44100, channels = 1, bitsPerSample = 16) {
	const byteRate = (sampleRate * channels * bitsPerSample) / 8;
	const blockAlign = (channels * bitsPerSample) / 8;
	const dataSize = sampleCount * channels * (bitsPerSample / 8);
	const buffer = Buffer.alloc(44);

	buffer.write("RIFF", 0);
	buffer.writeUInt32LE(36 + dataSize, 4);
	buffer.write("WAVE", 8);

	buffer.write("fmt ", 12);
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20);
	buffer.writeUInt16LE(channels, 22);
	buffer.writeUInt32LE(sampleRate, 24);
	buffer.writeUInt32LE(byteRate, 28);
	buffer.writeUInt16LE(blockAlign, 32);
	buffer.writeUInt16LE(bitsPerSample, 34);

	buffer.write("data", 36);
	buffer.writeUInt32LE(dataSize, 40);

	return buffer;
}

// 1. Signature Pulse Chime
function generatePulseChime() {
	const sampleRate = 44100;
	const duration = 3.2;
	const totalSamples = Math.floor(sampleRate * duration);
	const buffer = Buffer.alloc(totalSamples * 2);

	const pulses = [
		{ start: 0.0, end: 0.18, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 0.22, end: 0.4, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 0.44, end: 0.75, freq1: 1046.5, freq2: 1568, type: "triangle" },
		{ start: 1.1, end: 1.28, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 1.32, end: 1.5, freq1: 880, freq2: 1320, type: "sine" },
		{ start: 1.54, end: 1.95, freq1: 1174.66, freq2: 1760, type: "triangle" },
		{ start: 2.1, end: 3.1, freq1: 1046.5, freq2: 2093, type: "sine" },
	];

	for (let i = 0; i < totalSamples; i++) {
		const t = i / sampleRate;
		let sampleValue = 0;
		for (const p of pulses) {
			if (t >= p.start && t <= p.end) {
				const localT = t - p.start;
				const pulseDuration = p.end - p.start;
				let env = localT < 0.015 ? localT / 0.015 : Math.exp((-4 * (localT - 0.015)) / pulseDuration);
				const w1 = 2 * Math.PI * p.freq1 * localT;
				const w2 = 2 * Math.PI * p.freq2 * localT;
				let tone = 0.65 * Math.sin(w1) + 0.35 * Math.sin(w2);
				if (p.type === "triangle") tone += 0.2 * Math.sin(w1 * 2);
				sampleValue += tone * env;
			}
		}
		const clamped = Math.max(-0.95, Math.min(0.95, sampleValue));
		buffer.writeInt16LE(Math.floor(clamped * 32767), i * 2);
	}
	return Buffer.concat([createWavHeader(totalSamples, sampleRate), buffer]);
}

// 2. Radar Sonar Beeps
function generateRadarBeeps() {
	const sampleRate = 44100;
	const duration = 2.8;
	const totalSamples = Math.floor(sampleRate * duration);
	const buffer = Buffer.alloc(totalSamples * 2);

	const bursts = [
		{ start: 0.0, end: 0.14, freq: 1480 },
		{ start: 0.18, end: 0.32, freq: 1760 },
		{ start: 0.8, end: 0.94, freq: 1480 },
		{ start: 0.98, end: 1.12, freq: 1760 },
		{ start: 1.6, end: 1.74, freq: 1480 },
		{ start: 1.78, end: 1.92, freq: 1760 },
		{ start: 2.1, end: 2.7, freq: 1975.5 },
	];

	for (let i = 0; i < totalSamples; i++) {
		const t = i / sampleRate;
		let sampleValue = 0;
		for (const b of bursts) {
			if (t >= b.start && t <= b.end) {
				const localT = t - b.start;
				const len = b.end - b.start;
				const env = Math.sin((Math.PI * localT) / len);
				const tone = Math.sin(2 * Math.PI * b.freq * localT) + 0.25 * Math.sin(4 * Math.PI * b.freq * localT);
				sampleValue += tone * env;
			}
		}
		const clamped = Math.max(-0.95, Math.min(0.95, sampleValue));
		buffer.writeInt16LE(Math.floor(clamped * 32767), i * 2);
	}
	return Buffer.concat([createWavHeader(totalSamples, sampleRate), buffer]);
}

// 3. Harmonic Bell
function generateHarmonicBell() {
	const sampleRate = 44100;
	const duration = 3.5;
	const totalSamples = Math.floor(sampleRate * duration);
	const buffer = Buffer.alloc(totalSamples * 2);

	const strikes = [
		{ start: 0.0, freq: 523.25 }, // C5
		{ start: 0.8, freq: 659.25 }, // E5
		{ start: 1.6, freq: 783.99 }, // G5
		{ start: 2.2, freq: 1046.5 }, // C6
	];

	for (let i = 0; i < totalSamples; i++) {
		const t = i / sampleRate;
		let sampleValue = 0;
		for (const s of strikes) {
			if (t >= s.start) {
				const localT = t - s.start;
				const env = Math.exp(-2.2 * localT);
				if (env > 0.001) {
					const fundamental = Math.sin(2 * Math.PI * s.freq * localT);
					const harmonic2 = 0.5 * Math.sin(2 * Math.PI * s.freq * 2 * localT);
					const harmonic3 = 0.25 * Math.sin(2 * Math.PI * s.freq * 3 * localT);
					sampleValue += (fundamental + harmonic2 + harmonic3) * env * 0.7;
				}
			}
		}
		const clamped = Math.max(-0.95, Math.min(0.95, sampleValue));
		buffer.writeInt16LE(Math.floor(clamped * 32767), i * 2);
	}
	return Buffer.concat([createWavHeader(totalSamples, sampleRate), buffer]);
}

// 4. Digital Beep Watch
function generateDigitalWatch() {
	const sampleRate = 44100;
	const duration = 2.6;
	const totalSamples = Math.floor(sampleRate * duration);
	const buffer = Buffer.alloc(totalSamples * 2);

	const beeps = [
		{ start: 0.0, end: 0.08, freq: 2048 },
		{ start: 0.12, end: 0.20, freq: 2048 },
		{ start: 0.24, end: 0.32, freq: 2048 },
		{ start: 0.36, end: 0.44, freq: 2048 },
		{ start: 0.9, end: 0.98, freq: 2048 },
		{ start: 1.02, end: 1.10, freq: 2048 },
		{ start: 1.14, end: 1.22, freq: 2048 },
		{ start: 1.26, end: 1.34, freq: 2048 },
		{ start: 1.8, end: 1.88, freq: 2400 },
		{ start: 1.92, end: 2.00, freq: 2400 },
		{ start: 2.04, end: 2.30, freq: 2400 },
	];

	for (let i = 0; i < totalSamples; i++) {
		const t = i / sampleRate;
		let sampleValue = 0;
		for (const b of beeps) {
			if (t >= b.start && t <= b.end) {
				const localT = t - b.start;
				// square wave for crisp digital watch character
				const phase = (2 * Math.PI * b.freq * localT) % (2 * Math.PI);
				const wave = phase < Math.PI ? 0.7 : -0.7;
				sampleValue += wave;
			}
		}
		const clamped = Math.max(-0.95, Math.min(0.95, sampleValue));
		buffer.writeInt16LE(Math.floor(clamped * 32767), i * 2);
	}
	return Buffer.concat([createWavHeader(totalSamples, sampleRate), buffer]);
}

const sounds = [
	{ name: "daypulse_alarm.wav", buffer: generatePulseChime() },
	{ name: "daypulse_radar.wav", buffer: generateRadarBeeps() },
	{ name: "daypulse_harmonic.wav", buffer: generateHarmonicBell() },
	{ name: "daypulse_digital.wav", buffer: generateDigitalWatch() },
];

const targetDirs = [
	path.resolve("android-app/android/app/src/main/res/raw"),
	path.resolve("web-app/public/sounds"),
	path.resolve("android-app/out/sounds"),
];

for (const dir of targetDirs) {
	fs.mkdirSync(dir, { recursive: true });
	for (const s of sounds) {
		const dest = path.join(dir, s.name);
		fs.writeFileSync(dest, s.buffer);
		console.log(`Saved: ${dest} (${(s.buffer.length / 1024).toFixed(1)} KB)`);
	}
}
