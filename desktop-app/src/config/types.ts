export interface AlarmNotificationPayload {
	id: string;
	title: string;
	message: string;
	type: "task" | "event" | "routine" | "system";
	leadMinutes?: number;
	timestamp?: string;
	ringCount?: number;
	ringIntervalSeconds?: number;
}

export interface ElectronBridgeApi {
	isElectron: boolean;
	platform: string;
	minimizeToTray: () => void;
	minimize?: () => void;
	maximize?: () => void;
	toggleFullScreen?: () => void;
	close?: () => void;
	isMaximized?: () => Promise<boolean>;
	isFullScreen?: () => Promise<boolean>;
	onWindowStateChange?: (
		callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void,
	) => () => void;
	triggerAlarm: (payload: AlarmNotificationPayload) => void;
	onAlarmReceived: (callback: (payload: AlarmNotificationPayload) => void) => () => void;
	syncNow: () => Promise<boolean>;
	saveBackupFile?: (
		defaultName: string,
		base64Data: string,
	) => Promise<{ success: boolean; filePath?: string; canceled: boolean }>;
	pickBackupFile?: () => Promise<{
		fileName: string;
		base64Data: string;
	} | null>;
	openExternal?: (url: string) => Promise<boolean>;
	dispatch: <T = unknown>(req: {
		endpoint: string;
		method?: string;
		body?: unknown;
		query?: Record<string, string>;
		token?: string | null;
	}) => Promise<{
		statusCode: number;
		success: boolean;
		message?: string;
		data: T;
	}>;
}

declare global {
	interface Window {
		electronAPI?: ElectronBridgeApi;
	}
}
