export interface AlarmNotificationPayload {
	id: string;
	title: string;
	message: string;
	type: "task" | "event" | "routine" | "system";
	leadMinutes?: number;
	timestamp?: string;
}

export interface ElectronBridgeApi {
	isElectron: boolean;
	platform: string;
	minimizeToTray: () => void;
	triggerAlarm: (payload: AlarmNotificationPayload) => void;
	onAlarmReceived: (
		callback: (payload: AlarmNotificationPayload) => void,
	) => () => void;
	syncNow: () => Promise<boolean>;
}

declare global {
	interface Window {
		electronAPI?: ElectronBridgeApi;
	}
}
