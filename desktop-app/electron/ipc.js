const { ipcMain, BrowserWindow, app, Tray, Menu, nativeImage, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let trayInstance = null;

function setupIpcHandlers(mainWindow) {
	const iconPath = path.join(__dirname, "../assets/daypulse.ico");
	if (fs.existsSync(iconPath) && !trayInstance) {
		try {
			const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
			trayInstance = new Tray(icon);
			trayInstance.setToolTip("DayPulse - Task & Routine Tracker");

			const contextMenu = Menu.buildFromTemplate([
				{
					label: "Open DayPulse",
					click: () => {
						if (mainWindow && !mainWindow.isDestroyed()) {
							if (!mainWindow.isVisible()) mainWindow.show();
							if (mainWindow.isMinimized()) mainWindow.restore();
							mainWindow.focus();
						}
					},
				},
				{ type: "separator" },
				{
					label: "Quit DayPulse",
					click: () => {
						if (mainWindow && !mainWindow.isDestroyed()) {
							mainWindow.destroy();
						}
						destroyTray();
						app.quit();
					},
				},
			]);

			trayInstance.setContextMenu(contextMenu);
			trayInstance.on("double-click", () => {
				if (mainWindow && !mainWindow.isDestroyed()) {
					if (!mainWindow.isVisible()) mainWindow.show();
					if (mainWindow.isMinimized()) mainWindow.restore();
					mainWindow.focus();
				}
			});
		} catch (err) {
			console.warn("[DayPulse Desktop] Tray initialization warning:", err.message);
		}
	}

	const broadcastWindowState = (win) => {
		if (!win || win.isDestroyed()) return;
		win.webContents.send("window:state-changed", {
			isMaximized: win.isMaximized(),
			isFullScreen: win.isFullScreen(),
		});
	};

	if (mainWindow) {
		mainWindow.on("maximize", () => broadcastWindowState(mainWindow));
		mainWindow.on("unmaximize", () => broadcastWindowState(mainWindow));
		mainWindow.on("enter-full-screen", () => broadcastWindowState(mainWindow));
		mainWindow.on("leave-full-screen", () => broadcastWindowState(mainWindow));
	}

	const handleMinimize = (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win && !win.isDestroyed()) win.minimize();
	};

	const handleMaximize = (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win && !win.isDestroyed()) {
			if (win.isMaximized()) {
				win.unmaximize();
			} else {
				win.maximize();
			}
			broadcastWindowState(win);
		}
	};

	const handleToggleFullscreen = (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win && !win.isDestroyed()) {
			win.setFullScreen(!win.isFullScreen());
			broadcastWindowState(win);
		}
	};

	const handleClose = (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win && !win.isDestroyed()) {
			if (trayInstance) {
				win.hide();
			} else {
				win.close();
			}
		}
	};

	ipcMain.on("window:minimize", handleMinimize);
	ipcMain.on("window-minimize", handleMinimize);

	ipcMain.on("window:maximize", handleMaximize);
	ipcMain.on("window-maximize", handleMaximize);

	ipcMain.on("window:toggle-fullscreen", handleToggleFullscreen);
	ipcMain.on("window-fullscreen", handleToggleFullscreen);

	ipcMain.on("window:close", handleClose);
	ipcMain.on("window-close", handleClose);

	ipcMain.handle("window:is-maximized", (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		return win && !win.isDestroyed() ? win.isMaximized() : false;
	});

	ipcMain.handle("window:is-fullscreen", (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		return win && !win.isDestroyed() ? win.isFullScreen() : false;
	});

	ipcMain.handle("shell:open-external", async (_event, url) => {
		if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
			await shell.openExternal(url);
			return true;
		}
		return false;
	});
}

function destroyTray() {
	if (trayInstance) {
		trayInstance.destroy();
		trayInstance = null;
	}
}

module.exports = { setupIpcHandlers, destroyTray };
