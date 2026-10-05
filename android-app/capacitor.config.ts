import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.daypulse.tracker",
	appName: "DayPulse",
	webDir: "out",
	server: {
		androidScheme: "https",
		cleartext: true,
	},
	plugins: {
		LocalNotifications: {
			smallIcon: "ic_stat_alarm",
			iconColor: "#10b981",
			sound: "alarm_chime.wav",
		},
	},
};

export default config;
