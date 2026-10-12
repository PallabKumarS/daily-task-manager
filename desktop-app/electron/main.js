const { app } = require("electron");
const path = require("path");
const fs = require("fs");

app.name = "DayPulse";
const appData = process.env.APPDATA || (process.platform === "darwin" ? path.join(process.env.HOME || "", "Library/Application Support") : path.join(process.env.HOME || "", ".config"));
const userData = path.join(appData, "DayPulse");
try {
	if (!fs.existsSync(userData)) {
		fs.mkdirSync(userData, { recursive: true });
	}
	app.setPath("userData", userData);
} catch {}

const debugLogPath = path.join(userData, "electron_debug.log");
const log = (msg) => {
	try {
		fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${msg}\n`);
	} catch {}
};

process.on("uncaughtException", (err) => {
	log(`UNCAUGHT EXCEPTION: ${err && err.stack ? err.stack : err}`);
});

process.on("unhandledRejection", (reason) => {
	log(`UNHANDLED REJECTION: ${reason && reason.stack ? reason.stack : reason}`);
});

log("--- DayPulse Electron Starting ---");

const { createWindow, getWindow } = require("./window");
const { startServer, stopServer } = require("./server");
const { setupIpcHandlers, destroyTray } = require("./ipc");

function initApp() {
	log("initApp called");
	const mainWindow = createWindow();

	startServer(mainWindow);
	setupIpcHandlers(mainWindow);

	mainWindow.on("close", (e) => {
		log("mainWindow 'close' triggered");
	});

	mainWindow.on("closed", () => {
		log("mainWindow 'closed' triggered");
		stopServer();
		destroyTray();
	});

	mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
		log(`webContents did-fail-load: code=${code}, desc=${desc}, url=${url}`);
	});

	mainWindow.webContents.on("render-process-gone", (_event, details) => {
		log(`webContents render-process-gone: reason=${details.reason}, exitCode=${details.exitCode}`);
	});
}

const gotTheLock = app.requestSingleInstanceLock();
log(`requestSingleInstanceLock result: ${gotTheLock}`);

if (!gotTheLock) {
	log("Could not get single instance lock, quitting.");
	app.quit();
} else {
	app.on("second-instance", () => {
		log("second-instance event received");
		const mainWindow = getWindow();
		if (mainWindow) {
			if (!mainWindow.isVisible()) mainWindow.show();
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});

	app.on("ready", () => {
		log("app ready event");
		initApp();
	});

	app.on("window-all-closed", () => {
		log("window-all-closed event");
		if (process.platform !== "darwin") {
			stopServer();
			destroyTray();
			app.quit();
		}
	});

	app.on("before-quit", () => {
		log("before-quit event");
		stopServer();
		destroyTray();
	});

	app.on("activate", () => {
		log("activate event");
		const mainWindow = getWindow();
		if (mainWindow === null) {
			initApp();
		}
	});
}
