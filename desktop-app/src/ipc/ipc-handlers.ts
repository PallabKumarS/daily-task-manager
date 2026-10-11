import * as fs from "node:fs";
import * as path from "node:path";
import { type BrowserWindow, dialog, ipcMain, shell } from "electron";
import { triggerDesktopAlarm } from "../audio/index.js";
import type { AlarmNotificationPayload } from "../config/index.js";
import { handleIpcApiDispatch, type IpcApiRequest } from "../db/index.js";
import { triggerDailyAutoSync } from "../scheduler/index.js";

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
	ipcMain.on("window:minimize-to-tray", () => {
		const win = getMainWindow();
		win?.hide();
	});

	ipcMain.on("window:minimize", () => {
		const win = getMainWindow();
		win?.minimize();
	});

	ipcMain.on("window:maximize", () => {
		const win = getMainWindow();
		if (!win) return;
		if (win.isMaximized()) {
			win.unmaximize();
		} else {
			win.maximize();
		}
	});

	ipcMain.on("window:toggle-fullscreen", () => {
		const win = getMainWindow();
		if (!win) return;
		win.setFullScreen(!win.isFullScreen());
	});

	ipcMain.on("window:close", () => {
		const win = getMainWindow();
		win?.hide();
	});

	ipcMain.handle("window:is-maximized", () => {
		const win = getMainWindow();
		return win ? win.isMaximized() : false;
	});

	ipcMain.handle("window:is-fullscreen", () => {
		const win = getMainWindow();
		return win ? win.isFullScreen() : false;
	});

	ipcMain.on("alarm:trigger", (_event, payload: AlarmNotificationPayload) => {
		const win = getMainWindow();
		if (win) {
			triggerDesktopAlarm(win, payload);
		}
	});

	ipcMain.handle("api:dispatch", async (_event, req: IpcApiRequest) => {
		return handleIpcApiDispatch(req);
	});

	ipcMain.handle("sync:now", async () => {
		const win = getMainWindow();
		return triggerDailyAutoSync(win);
	});

	ipcMain.handle("shell:open-external", async (_event, url: string) => {
		if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
			await shell.openExternal(url);
			return true;
		}
		return false;
	});

	ipcMain.handle("backup:save-dialog", async (_event, defaultName: string, base64Data: string) => {
		const win = getMainWindow();
		if (!win) return { success: false, canceled: true };

		const result = await dialog.showSaveDialog(win, {
			title: "Save DayPulse Backup Archive",
			defaultPath: defaultName || "DayPulse_Backup.zip",
			filters: [
				{
					name: "DayPulse Archive (*.zip, *.daypulse)",
					extensions: ["zip", "daypulse"],
				},
				{ name: "All Files (*.*)", extensions: ["*"] },
			],
		});

		if (result.canceled || !result.filePath) {
			return { success: false, canceled: true };
		}

		try {
			const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, "").trim();
			const buffer = Buffer.from(cleanBase64, "base64");
			fs.writeFileSync(result.filePath, buffer);
			return { success: true, filePath: result.filePath, canceled: false };
		} catch (err) {
			console.error("[DayPulse Desktop] Failed to write backup file:", err);
			return { success: false, canceled: false };
		}
	});

	ipcMain.handle("backup:open-dialog", async () => {
		const win = getMainWindow();
		if (!win) return null;

		const result = await dialog.showOpenDialog(win, {
			title: "Select DayPulse Backup Archive",
			properties: ["openFile"],
			filters: [
				{
					name: "DayPulse Archive (*.zip, *.daypulse, *.json)",
					extensions: ["zip", "daypulse", "json"],
				},
				{ name: "All Files (*.*)", extensions: ["*"] },
			],
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		const filePath = result.filePaths[0];
		try {
			const buffer = fs.readFileSync(filePath);
			const fileName = path.basename(filePath);
			return {
				fileName,
				base64Data: buffer.toString("base64"),
			};
		} catch (err) {
			console.error("[DayPulse Desktop] Failed to read backup file:", err);
			return null;
		}
	});
}
