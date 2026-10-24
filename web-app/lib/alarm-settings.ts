export type AlarmToneId = "alarm" | "radar" | "harmonic" | "digital";

export interface AlarmAudioConfig {
	ringCount: number;
	ringIntervalSeconds: number;
	tone: AlarmToneId;
}

export const DEFAULT_ALARM_CONFIG: AlarmAudioConfig = {
	ringCount: 3,
	ringIntervalSeconds: 10,
	tone: "alarm",
};

export const ALARM_TONE_OPTIONS: {
	label: string;
	value: AlarmToneId;
	file: string;
	description: string;
}[] = [
	{
		label: "Pulse Chime (Signature)",
		value: "alarm",
		file: "daypulse_alarm.wav",
		description: "Energetic multi-tone chime flourish",
	},
	{
		label: "Radar Beep (Sonar)",
		value: "radar",
		file: "daypulse_radar.wav",
		description: "Crisp rhythmic sonar double-beeps",
	},
	{
		label: "Harmonic Bell (Resonant)",
		value: "harmonic",
		file: "daypulse_harmonic.wav",
		description: "Serene, rich acoustic bell strike",
	},
	{
		label: "Digital Watch (Retro)",
		value: "digital",
		file: "daypulse_digital.wav",
		description: "Classic high-frequency electronic watch alarm",
	},
];

export const RING_COUNT_OPTIONS = [
	{ label: "1x Chime (Brief ping)", value: "1" },
	{ label: "2x Rings (Double alert)", value: "2" },
	{ label: "3x Rings (Standard)", value: "3" },
	{ label: "5x Rings (Persistent)", value: "5" },
	{ label: "10x Rings (Urgent)", value: "10" },
	{ label: "Continuous Loop (Until dismissed)", value: "0" },
];

export const RING_INTERVAL_OPTIONS = [
	{ label: "Every 5 seconds", value: "5" },
	{ label: "Every 10 seconds", value: "10" },
	{ label: "Every 15 seconds", value: "15" },
	{ label: "Every 30 seconds", value: "30" },
	{ label: "Every 1 minute", value: "60" },
];

const ALARM_TAG_REGEX = /\[Alarm:\s*rings=(\d+),\s*freq=(\d+)s(?:,\s*tone=([a-z0-9_-]+))?\]/i;

export function parseAlarmConfig(description?: string | null): {
	config: AlarmAudioConfig;
	userNotes: string;
} {
	if (!description) {
		return {
			config: { ...DEFAULT_ALARM_CONFIG },
			userNotes: "",
		};
	}

	const match = description.match(ALARM_TAG_REGEX);
	if (!match) {
		return {
			config: { ...DEFAULT_ALARM_CONFIG },
			userNotes: description.trim(),
		};
	}

	const rings = Number.parseInt(match[1], 10);
	const freq = Number.parseInt(match[2], 10);
	const tone = (match[3] as AlarmToneId) || DEFAULT_ALARM_CONFIG.tone;
	const validTone: AlarmToneId = ALARM_TONE_OPTIONS.some((t) => t.value === tone) ? tone : "alarm";
	const userNotes = description.replace(match[0], "").trim();

	return {
		config: {
			ringCount: Number.isNaN(rings) ? DEFAULT_ALARM_CONFIG.ringCount : rings,
			ringIntervalSeconds: Number.isNaN(freq) ? DEFAULT_ALARM_CONFIG.ringIntervalSeconds : freq,
			tone: validTone,
		},
		userNotes,
	};
}

export function formatAlarmDescription(userNotes: string, config: AlarmAudioConfig): string {
	const clean = (userNotes || "").replace(ALARM_TAG_REGEX, "").trim();
	const tone = config.tone || "alarm";
	const tag = `[Alarm: rings=${config.ringCount}, freq=${config.ringIntervalSeconds}s, tone=${tone}]`;
	return clean ? `${clean}\n\n${tag}` : tag;
}

export function formatTriggeredTime(isoDateString?: string | null): string {
	if (!isoDateString) return "";
	const date = new Date(isoDateString);
	if (Number.isNaN(date.getTime())) return "";

	const now = new Date();
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	const timeStr = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});

	if (isToday) {
		return `Today at ${timeStr}`;
	}

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const isYesterday =
		date.getDate() === yesterday.getDate() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getFullYear() === yesterday.getFullYear();

	if (isYesterday) {
		return `Yesterday at ${timeStr}`;
	}

	const dateStr = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

	return `${dateStr} at ${timeStr}`;
}
