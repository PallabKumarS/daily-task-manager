import * as path from "node:path";
import {
	type BrowserWindow,
	type NativeImage,
	Notification,
	nativeImage,
} from "electron";
import { playAlarmSound } from "./audio-player.js";
import type { AlarmNotificationPayload } from "./types.js";

let appIcon: NativeImage | null = null;

function getNotificationIcon(): NativeImage {
	if (appIcon && !appIcon.isEmpty()) return appIcon;

	const iconCandidates = [
		path.resolve(process.cwd(), "assets", "logo.png"),
		path.resolve(process.cwd(), "..", "assets", "logo.png"),
		path.resolve(__dirname, "../../assets/logo.png"),
		path.resolve(__dirname, "../assets/logo.png"),
	];

	for (const candidate of iconCandidates) {
		try {
			const loaded = nativeImage.createFromPath(candidate);
			if (!loaded.isEmpty()) {
				appIcon = loaded;
				return appIcon;
			}
		} catch {
			// Try next path
		}
	}

	appIcon = nativeImage.createEmpty();
	return appIcon;
}

export function triggerDesktopAlarm(
	mainWindow: BrowserWindow,
	payload: AlarmNotificationPayload,
): void {
	// 1. Play background chime audio
	playAlarmSound();

	// 2. Display native OS notification
	if (Notification.isSupported()) {
		const notification = new Notification({
			title: payload.title,
			body: payload.message,
			icon: getNotificationIcon(),
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
