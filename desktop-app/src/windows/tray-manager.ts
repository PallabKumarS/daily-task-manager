import { app, type BrowserWindow, Menu, nativeImage, Tray } from "electron";
import { getIcoIconPath, getPngIconPath } from "./windows-branding.js";

let tray: Tray | null = null;

export function setupTray(
	mainWindow: BrowserWindow,
	onSyncRequested?: () => void,
	onQuitRequested?: () => void,
): Tray {
	if (tray) return tray;

	const icoPath = getIcoIconPath();
	const pngPath = getPngIconPath();

	let trayIcon = nativeImage.createEmpty();
	const candidates = [icoPath, pngPath].filter(Boolean);

	for (const candidate of candidates) {
		try {
			const loaded = nativeImage.createFromPath(candidate);
			if (!loaded.isEmpty()) {
				trayIcon = loaded.resize({ width: 16, height: 16 });
				break;
			}
		} catch {
			// Try next candidate
		}
	}

	tray = new Tray(trayIcon);
	tray.setToolTip("DayPulse - Task & Routine Tracker");

	const contextMenu = Menu.buildFromTemplate([
		{
			label: "Open DayPulse",
			click: () => {
				if (!mainWindow.isVisible()) {
					mainWindow.show();
				}
				mainWindow.focus();
			},
		},
		{
			label: "Sync with Cloud",
			click: () => {
				if (onSyncRequested) {
					onSyncRequested();
				}
			},
		},
		{ type: "separator" },
		{
			label: "Quit DayPulse",
			click: () => {
				if (onQuitRequested) {
					onQuitRequested();
				} else {
					app.quit();
				}
			},
		},
	]);

	tray.setContextMenu(contextMenu);

	tray.on("double-click", () => {
		if (mainWindow.isVisible()) {
			mainWindow.hide();
		} else {
			mainWindow.show();
			mainWindow.focus();
		}
	});

	tray.on("click", () => {
		if (!mainWindow.isVisible()) {
			mainWindow.show();
			mainWindow.focus();
		}
	});

	return tray;
}

export function destroyTray(): void {
	if (tray) {
		tray.destroy();
		tray = null;
	}
}
