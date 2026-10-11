import { type BrowserWindow, Notification } from "electron";
import type { AlarmNotificationPayload } from "../config/types.js";
import { getWindowIcon } from "../windows/windows-branding.js";
import { playAlarmSound } from "./audio-player.js";

export function triggerDesktopAlarm(
	mainWindow: BrowserWindow,
	payload: AlarmNotificationPayload,
): void {
	// 1. Play background chime audio
	playAlarmSound(payload.ringCount, payload.ringIntervalSeconds);

	// 2. Display native OS notification
	if (Notification.isSupported()) {
		const notification = new Notification({
			title: payload.title,
			body: payload.message,
			icon: getWindowIcon(),
			urgency: "critical",
		});

		notification.on("click", () => {
			if (!mainWindow.isVisible()) {
				mainWindow.show();
			}
			mainWindow.focus();
		});

		notification.show();
	}

	// 3. Dispatch IPC to renderer window
	if (!mainWindow.isDestroyed()) {
		mainWindow.webContents.send("alarm:received", payload);
	}
}
