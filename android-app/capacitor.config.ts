import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.daypulse.tracker",
	appName: "DayPulse",
	webDir: "out",
	backgroundColor: "#090a10",
	server: {
		androidScheme: "https",
		cleartext: true,
	},
	plugins: {
		LocalNotifications: {
			smallIcon: "ic_stat_alarm",
			iconColor: "#10b981",
			sound: "daypulse_alarm.wav",
		},
	},
};

export default config;
