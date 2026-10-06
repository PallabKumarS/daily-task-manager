import { app, type BrowserWindow } from "electron";
import { destroyAudioPlayer, initAudioPlayer } from "./audio/index.js";
import { ensureDevServerReady, loadDesktopEnv, stopDevServer } from "./config/index.js";
import {
	closePrismaDatabase,
	initPrismaDatabase,
	stopGoogleOAuthLoopbackServer,
} from "./db/index.js";
import { registerIpcHandlers } from "./ipc/index.js";
import {
	startDailySyncScheduler,
	startLocalScheduler,
	stopDailySyncScheduler,
	stopLocalScheduler,
	triggerDailyAutoSync,
} from "./scheduler/index.js";
import {
	createMainWindow,
	destroyTray,
	navigateMainWindow,
	setupTray,
	setupWindowsBranding,
} from "./windows/index.js";

loadDesktopEnv();

app.name = "DayPulse";
app.setName("DayPulse");
setupWindowsBranding();

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let cleanupFinished = false;

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

async function cleanupAndQuit(): Promise<void> {
	if (cleanupFinished) return;
	cleanupFinished = true;
	isQuitting = true;

	try {
		stopGoogleOAuthLoopbackServer();
	} catch (err) {
		console.warn("[DayPulse Desktop] OAuth shutdown notice:", err);
	}

	try {
		stopLocalScheduler();
		stopDailySyncScheduler();
	} catch (err) {
		console.warn("[DayPulse Desktop] Scheduler shutdown notice:", err);
	}

	try {
		destroyAudioPlayer();
	} catch (err) {
		console.warn("[DayPulse Desktop] Audio player shutdown notice:", err);
	}

	try {
		destroyTray();
	} catch (err) {
		console.warn("[DayPulse Desktop] Tray shutdown notice:", err);
	}

	try {
		stopDevServer();
	} catch (err) {
		console.warn("[DayPulse Desktop] Dev server shutdown notice:", err);
	}

	try {
		await closePrismaDatabase();
	} catch (err) {
		console.warn("[DayPulse Desktop] Prisma shutdown notice:", err);
	}

	if (mainWindow && !mainWindow.isDestroyed()) {
		mainWindow.destroy();
		mainWindow = null;
	}

	app.quit();
	setTimeout(() => {
		process.exit(0);
	}, 1000);
}

app.whenReady().then(async () => {
	initAudioPlayer();
	registerIpcHandlers(() => mainWindow);

	mainWindow = createMainWindow(() => {
		if (!isQuitting) {
			mainWindow?.hide();
		}
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	setupTray(
		mainWindow,
		async () => {
			if (!mainWindow) return;
			await triggerDailyAutoSync(mainWindow);
		},
		() => {
			cleanupAndQuit();
		},
	);

	await initPrismaDatabase();

	startLocalScheduler(mainWindow);
	startDailySyncScheduler(mainWindow);

	const targetUrl = process.env.APP_URL || "http://localhost:3000/dashboard";
	if (process.env.NODE_ENV !== "production") {
		await ensureDevServerReady();
	}

	await navigateMainWindow(mainWindow, targetUrl);
});

app.on("before-quit", (event) => {
	if (!cleanupFinished) {
		event.preventDefault();
		cleanupAndQuit().then(() => {
			app.quit();
		});
	}
});

const handleTerminationSignal = () => {
	cleanupAndQuit().then(() => {
		process.exit(0);
	});
};

process.on("SIGINT", handleTerminationSignal);
process.on("SIGTERM", handleTerminationSignal);
process.on("exit", () => {
	stopGoogleOAuthLoopbackServer();
	stopDevServer();
});

app.on("will-quit", () => {
	stopGoogleOAuthLoopbackServer();
	stopDevServer();
});

app.on("window-all-closed", () => {
	if (isQuitting) {
		app.quit();
	}
});
