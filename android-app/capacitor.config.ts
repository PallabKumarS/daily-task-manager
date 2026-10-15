import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.daypulse.tracker",
	appName: "DayPulse",
	webDir: "out",
	backgroundColor: "#0b0f17",
	server: {
		androidScheme: "https",
		cleartext: true,
	},
	plugins: {
		LocalNotifications: {
			smallIcon: "ic_stat_alarm",
			iconColor: "#0d9488",
			sound: "daypulse_alarm.wav",
		},
	},
};

export default config;
