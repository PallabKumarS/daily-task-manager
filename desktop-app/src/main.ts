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
import { ensureDevServerReady, stopDevServer } from "./dev-server-helper.js";
import {
	startLocalScheduler,
	stopLocalScheduler,
} from "./scheduler/local-scheduler.js";
import {
	closeSplashWindow,
	createSplashWindow,
	updateSplashStatus,
} from "./splash-window.js";
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
		show: false,
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
	// 1. Show animated splash screen immediately
	createSplashWindow();
	updateSplashStatus("Initializing local database...");

	// 2. Initialize hidden audio synthesizer window
	initAudioPlayer();

	// 3. Register IPC handlers
	registerIpcHandlers();

	// 4. Initialize in-process SQLite database
	await initPrismaDatabase();
	updateSplashStatus("Loading workspace...");

	// 5. Create primary UI window (hidden while loading)
	const win = await createMainWindow();

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

	// 7. Start in-process background reminder scheduler
	startLocalScheduler(win);

	// 8. Ensure UI development server is running in dev mode
	const targetUrl = process.env.APP_URL || "http://localhost:3000";
	if (process.env.NODE_ENV !== "production") {
		await ensureDevServerReady(targetUrl);
	}

	// 9. Load URL with retry handling
	updateSplashStatus("Connecting to DayPulse interface...");
	for (let attempt = 1; attempt <= 30; attempt++) {
		try {
			await win.loadURL(targetUrl);
			console.log(`[DayPulse Desktop] UI connected at ${targetUrl}`);
			break;
		} catch {
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	// 10. Smoothly close splash screen and reveal main window
	updateSplashStatus("Workspace ready!");
	await new Promise((r) => setTimeout(r, 500));
	await closeSplashWindow(win);
});

app.on("before-quit", async () => {
	isQuitting = true;
	stopLocalScheduler();
	destroyAudioPlayer();
	destroyTray();
	stopDevServer();
	await closePrismaDatabase();
});

app.on("window-all-closed", () => {
	// On Windows/Linux, do not quit if running as background tray utility
	if (isQuitting) {
		app.quit();
	}
});
