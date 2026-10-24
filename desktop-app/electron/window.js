const { BrowserWindow, shell, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;

function createWindow() {
	const iconPath = path.join(__dirname, "../assets/daypulse.ico");
	const splashPath = path.join(__dirname, "../assets/splash.html");
	const preloadPath = path.join(__dirname, "preload.js");

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 960,
		minHeight: 640,
		show: true,
		title: "DayPulse — Client UI",
		backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0f17" : "#f5f7fb",
		frame: false,
		icon: fs.existsSync(iconPath) ? iconPath : undefined,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			backgroundThrottling: true,
			preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
		},
	});

	nativeTheme.on("updated", () => {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#0b0f17" : "#f5f7fb");
		}
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			shell.openExternal(url);
		}
		return { action: "deny" };
	});

	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (
			!url.startsWith("http://localhost:") &&
			!url.startsWith("http://127.0.0.1:") &&
			!url.startsWith("file://")
		) {
			event.preventDefault();
			shell.openExternal(url);
		}
	});

	if (fs.existsSync(splashPath)) {
		mainWindow.loadFile(splashPath);
	}

	mainWindow.on("page-title-updated", (event) => {
		event.preventDefault();
		mainWindow.setTitle("DayPulse — Client UI");
	});

	return mainWindow;
}

function getWindow() {
	return mainWindow;
}

module.exports = { createWindow, getWindow };
