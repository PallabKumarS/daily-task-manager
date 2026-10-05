import * as path from "node:path";
import {
	app,
	BrowserWindow,
	ipcMain,
	type NativeImage,
	nativeImage,
} from "electron";
import { triggerDesktopAlarm } from "./alarm-manager.js";
import { destroyAudioPlayer, initAudioPlayer } from "./audio-player.js";
import {
	handleIpcApiDispatch,
	type IpcApiRequest,
} from "./db/ipc-dispatcher.js";
import { closePrismaDatabase, initPrismaDatabase } from "./db/prisma-client.js";
import {
	startLocalScheduler,
	stopLocalScheduler,
} from "./scheduler/local-scheduler.js";
import { destroyTray, setupTray } from "./tray-manager.js";
import type { AlarmNotificationPayload } from "./types.js";

// Windows AppUserModelID for Action Center notifications
if (process.platform === "win32") {
	app.setAppUserModelId("com.daypulse.tracker");
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Request single-instance lock to prevent duplicate background instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
	process.exit(0);
}

app.on("second-instance", () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		if (!mainWindow.isVisible()) mainWindow.show();
		mainWindow.focus();
	}
});

function getWindowIcon(): NativeImage {
	const candidates = [
		path.resolve(process.cwd(), "assets", "logo.png"),
		path.resolve(process.cwd(), "..", "assets", "logo.png"),
		path.resolve(__dirname, "../../assets/logo.png"),
		path.resolve(__dirname, "../assets/logo.png"),
	];

	for (const candidate of candidates) {
		try {
			const img = nativeImage.createFromPath(candidate);
			if (!img.isEmpty()) return img;
		} catch {
			// Continue
		}
	}
	return nativeImage.createEmpty();
}

async function createMainWindow(): Promise<BrowserWindow> {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 850,
		minWidth: 920,
		minHeight: 640,
		title: "DayPulse",
		icon: getWindowIcon(),
		backgroundColor: "#09090b",
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	mainWindow.on("close", (event) => {
		if (!isQuitting) {
			event.preventDefault();
			mainWindow?.hide();
		}
	});

	const targetUrl = process.env.APP_URL || "http://localhost:3000";
	console.log(`[DayPulse Desktop] Loading client UI from: ${targetUrl}`);

	mainWindow.loadURL(targetUrl).catch((err) => {
		console.warn(
			`[DayPulse Desktop] Failed to load ${targetUrl}:`,
			err.message,
		);
	});

	return mainWindow;
}

function registerIpcHandlers(): void {
	ipcMain.on("window:minimize-to-tray", () => {
		mainWindow?.hide();
	});

	ipcMain.on("alarm:trigger", (_event, payload: AlarmNotificationPayload) => {
		if (mainWindow) {
			triggerDesktopAlarm(mainWindow, payload);
		}
	});

	ipcMain.handle("api:dispatch", async (_event, req: IpcApiRequest) => {
		return handleIpcApiDispatch(req);
	});

	ipcMain.handle("sync:now", async () => {
		console.log("[DayPulse Desktop] Manual Google Drive sync requested");
		return true;
	});
}

app.whenReady().then(async () => {
	// 1. Initialize hidden audio synthesizer window
	initAudioPlayer();

	// 2. Initialize in-process SQLite database
	await initPrismaDatabase();

	// 3. Register IPC handlers
	registerIpcHandlers();

	// 4. Create primary UI window
	const win = await createMainWindow();

	// 5. Start in-process background reminder scheduler
	startLocalScheduler(win);

	// 6. Setup System Tray
	setupTray(
		win,
		() => {
			win.webContents.send("sync:requested");
		},
		() => {
			isQuitting = true;
			app.quit();
		},
	);
});

app.on("before-quit", async () => {
	isQuitting = true;
	stopLocalScheduler();
	destroyAudioPlayer();
	destroyTray();
	await closePrismaDatabase();
});

app.on("window-all-closed", () => {
	// On Windows/Linux, do not quit if running as background tray utility
	if (isQuitting) {
		app.quit();
	}
});
