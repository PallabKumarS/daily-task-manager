import * as path from "node:path";
import { app, type BrowserWindow, Menu, nativeImage, Tray } from "electron";

let tray: Tray | null = null;

export function setupTray(
	mainWindow: BrowserWindow,
	onSyncRequested?: () => void,
	onQuitRequested?: () => void,
): Tray {
	if (tray) return tray;

	const iconCandidates = [
		path.resolve(__dirname, "../assets/favicon.ico"),
		path.resolve(__dirname, "../../assets/favicon.ico"),
		path.resolve(process.cwd(), "desktop-app", "assets", "favicon.ico"),
		path.resolve(process.cwd(), "assets", "favicon.ico"),
		path.resolve(process.cwd(), "..", "assets", "favicon.ico"),
		path.resolve(__dirname, "../assets/logo.png"),
		path.resolve(__dirname, "../../assets/logo.png"),
		path.resolve(process.cwd(), "desktop-app", "assets", "logo.png"),
		path.resolve(process.cwd(), "assets", "logo.png"),
	];

	let trayIcon = nativeImage.createEmpty();
	for (const candidate of iconCandidates) {
		try {
			const loaded = nativeImage.createFromPath(candidate);
			if (!loaded.isEmpty()) {
				trayIcon = loaded.resize({ width: 16, height: 16 });
				break;
			}
		} catch {
			// Continue to next candidate
		}
	}

	tray = new Tray(trayIcon);
	tray.setToolTip("DayPulse - Task & Routine Tracker");

	const updateContextMenu = () => {
		const isAutoStart = app.getLoginItemSettings().openAtLogin;

		const contextMenu = Menu.buildFromTemplate([
			{
				label: "Open DayPulse",
				click: () => {
					mainWindow.show();
					mainWindow.focus();
				},
			},
			{ type: "separator" },
			{
				label: "Sync with Google Drive",
				click: () => {
					if (onSyncRequested) {
						onSyncRequested();
					}
				},
			},
			{
				label: "Launch at Startup",
				type: "checkbox",
				checked: isAutoStart,
				click: (item) => {
					app.setLoginItemSettings({
						openAtLogin: item.checked,
					});
					updateContextMenu();
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

		tray?.setContextMenu(contextMenu);
	};

	updateContextMenu();

	tray.on("click", () => {
		if (mainWindow.isVisible()) {
			if (mainWindow.isFocused()) {
				mainWindow.hide();
			} else {
				mainWindow.focus();
			}
		} else {
			mainWindow.show();
			mainWindow.focus();
		}
	});

	tray.on("double-click", () => {
		mainWindow.show();
		mainWindow.focus();
	});

	return tray;
}

export function destroyTray(): void {
	if (tray) {
		tray.destroy();
		tray = null;
	}
}
