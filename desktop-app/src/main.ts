import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	type NativeImage,
	nativeImage,
	shell,
} from "electron";
import { triggerDesktopAlarm } from "./alarm-manager.js";
import { destroyAudioPlayer, initAudioPlayer } from "./audio-player.js";
import { executeGoogleSyncUpload, stopGoogleOAuthLoopbackServer } from "./db/google-sync.js";
import { handleIpcApiDispatch, type IpcApiRequest } from "./db/ipc-dispatcher.js";
import {
	closePrismaDatabase,
	getCurrentUserId,
	getPrismaClient,
	initPrismaDatabase,
} from "./db/prisma-client.js";
import { ensureDevServerReady, stopDevServer } from "./dev-server-helper.js";
import { loadDesktopEnv } from "./env-loader.js";
import { startLocalScheduler, stopLocalScheduler } from "./scheduler/local-scheduler.js";
import { closeSplashWindow, createSplashWindow, updateSplashStatus } from "./splash-window.js";
import { destroyTray, setupTray } from "./tray-manager.js";
import type { AlarmNotificationPayload } from "./types.js";

loadDesktopEnv();

app.name = "DayPulse";
app.setName("DayPulse");

function getWindowIconPath(): string {
	const candidates = [
		path.join(__dirname, "assets", "daypulse.ico"),
		path.join(__dirname, "assets", "favicon.ico"),
		path.resolve(__dirname, "../assets/daypulse.ico"),
		path.resolve(__dirname, "../assets/favicon.ico"),
		path.resolve(__dirname, "../../assets/favicon.ico"),
		path.resolve(process.cwd(), "desktop-app", "assets", "daypulse.ico"),
		path.resolve(process.cwd(), "desktop-app", "assets", "favicon.ico"),
		path.resolve(process.cwd(), "assets", "favicon.ico"),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return "";
}

function getWindowIcon(): NativeImage {
	const iconPath = getWindowIconPath();
	if (iconPath) {
		try {
			const img = nativeImage.createFromPath(iconPath);
			if (!img.isEmpty()) return img;
		} catch {
			// Continue
		}
	}
	return nativeImage.createEmpty();
}

// Windows AppUserModelID and Start Menu shortcut for DayPulse branding in Action Center & Taskbar
if (process.platform === "win32") {
	const appId = "com.daypulse.tracker";
	app.setAppUserModelId(appId);

	const windowIcon = getWindowIconPath();

	try {
		const classesAumidKey = `HKCU\\Software\\Classes\\AppUserModelId\\${appId}`;
		execSync(`reg add "${classesAumidKey}" /v DisplayName /t REG_SZ /d "DayPulse" /f`, {
			stdio: "ignore",
		});
		if (windowIcon) {
			execSync(`reg add "${classesAumidKey}" /v IconUri /t REG_SZ /d "${windowIcon}" /f`, {
				stdio: "ignore",
			});
			execSync(`reg add "${classesAumidKey}" /v IconBackgroundColor /t REG_SZ /d "FF09090B" /f`, {
				stdio: "ignore",
			});
		}
	} catch {
		// Silent fallback if classes registry edit fails
	}

	try {
		const regKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\\${appId}`;
		execSync(`reg add "${regKey}" /v DisplayName /t REG_SZ /d "DayPulse" /f`, {
			stdio: "ignore",
		});
		if (windowIcon) {
			execSync(`reg add "${regKey}" /v IconUri /t REG_SZ /d "${windowIcon}" /f`, {
				stdio: "ignore",
			});
		}
		execSync(`reg add "${regKey}" /v ShowInActionCenter /t REG_DWORD /d 1 /f`, {
			stdio: "ignore",
		});
	} catch {
		// Silent fallback if registry edit fails
	}

	try {
		const programsDir = path.join(
			app.getPath("appData"),
			"Microsoft",
			"Windows",
			"Start Menu",
			"Programs",
		);
		const shortcutPath = path.join(programsDir, "DayPulse.lnk");
		const iconPath = getWindowIconPath();

		if (fs.existsSync(shortcutPath)) {
			try {
				execSync(`attrib -R "${shortcutPath}"`, { stdio: "ignore" });
			} catch {
				// Ignore if already writable
			}
		}

		const shortcutOptions = {
			target: process.execPath,
			args: app.isPackaged ? "" : `"${path.resolve(__dirname, "..")}"`,
			appUserModelId: appId,
			icon: iconPath,
			iconIndex: 0,
			description: "DayPulse - Standalone Workspace",
			toastActivatorClsid: "{0796B928-7EA1-4E7A-AF15-FCF1640FE3F5}",
		};

		const op = fs.existsSync(shortcutPath) ? "replace" : "create";
		const shortcutWritten = shell.writeShortcutLink(shortcutPath, op, shortcutOptions);
		if (!shortcutWritten && op === "replace") {
			shell.writeShortcutLink(shortcutPath, "create", shortcutOptions);
		}

		try {
			execSync(`attrib +R "${shortcutPath}"`, { stdio: "ignore" });
		} catch {
			// Ignore if locking is not supported
		}
	} catch (err) {
		console.warn("[DayPulse Desktop] Shortcut registration notice:", err);
	}
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

async function createMainWindow(): Promise<BrowserWindow> {
	const iconPath = getWindowIconPath();
	const windowIcon = iconPath ? nativeImage.createFromPath(iconPath) : getWindowIcon();

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 850,
		minWidth: 920,
		minHeight: 640,
		show: false,
		title: "DayPulse",
		icon: iconPath || (!windowIcon.isEmpty() ? windowIcon : undefined),
		backgroundColor: "#09090b",
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	if (iconPath) {
		mainWindow.setIcon(iconPath);
	} else if (!windowIcon.isEmpty()) {
		mainWindow.setIcon(windowIcon);
	}

	mainWindow.on("close", (event) => {
		if (!isQuitting) {
			event.preventDefault();
			mainWindow?.hide();
		}
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	if (process.env.NODE_ENV !== "production") {
		if (process.argv.includes("--devtools")) {
			mainWindow.webContents.openDevTools({ mode: "detach" });
		}

		mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
			console.error(`[Preload Error] in ${preloadPath}:`, error);
		});

		mainWindow.webContents.on("render-process-gone", (_event, details) => {
			console.error("[Renderer Process Gone]", details);
		});

		mainWindow.webContents.on("did-start-loading", () => {
			console.log("[DayPulse Desktop] WebContents started loading");
		});

		mainWindow.webContents.on("did-navigate", (_event, url) => {
			console.log(`[DayPulse Desktop] Navigated to: ${url}`);
		});

		mainWindow.webContents.on("before-input-event", (event, input) => {
			if (
				input.type === "keyDown" &&
				(input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i"))
			) {
				mainWindow?.webContents.toggleDevTools();
				event.preventDefault();
			}
		});

		mainWindow.webContents.on("console-message", (event: unknown, ...args: unknown[]) => {
			let level = 0;
			let message = "";
			let line = 0;
			let sourceId = "";

			if (
				typeof event === "object" &&
				event !== null &&
				"message" in (event as Record<string, unknown>)
			) {
				const ev = event as {
					level?: number;
					message?: string;
					line?: number;
					sourceId?: string;
				};
				level = ev.level ?? 0;
				message = ev.message ?? "";
				line = ev.line ?? 0;
				sourceId = ev.sourceId ?? "";
			} else {
				level = typeof args[0] === "number" ? args[0] : 0;
				message = typeof args[1] === "string" ? args[1] : String(args[1] || "");
				line = typeof args[2] === "number" ? args[2] : 0;
				sourceId = typeof args[3] === "string" ? args[3] : "";
			}

			const tags = ["LOG", "INFO", "WARN", "ERROR"];
			console.log(`[Renderer ${tags[level] || "LOG"}] ${message} (${sourceId}:${line})`);
		});

		mainWindow.webContents.on(
			"did-fail-load",
			(_event, errorCode, errorDescription, validatedURL) => {
				console.error(
					`[Renderer Load Error] ${errorDescription} (${errorCode}) for ${validatedURL}`,
				);
			},
		);
	}

	return mainWindow;
}

let cleanupFinished = false;

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
		const userId = getCurrentUserId();
		if (!userId) {
			return { success: false, message: "No active user session" };
		}
		try {
			const prisma = getPrismaClient();
			const result = await executeGoogleSyncUpload(prisma, userId);
			mainWindow?.webContents.send("daypulse:sync-updated", result);
			return result;
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to sync with Google Drive";
			return { success: false, message: msg };
		}
	});

	ipcMain.handle("shell:open-external", async (_event, url: string) => {
		if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
			await shell.openExternal(url);
			return true;
		}
		return false;
	});

	ipcMain.handle("backup:save-dialog", async (_event, defaultName: string, base64Data: string) => {
		if (!mainWindow) return { success: false, canceled: true };
		const result = await dialog.showSaveDialog(mainWindow, {
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
		if (!mainWindow) return null;
		const result = await dialog.showOpenDialog(mainWindow, {
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

app.whenReady().then(async () => {
	// 1. Show animated splash screen immediately
	createSplashWindow(getWindowIconPath());
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
		async () => {
			const userId = getCurrentUserId();
			if (!userId) {
				win.show();
				win.focus();
				return;
			}
			try {
				const prisma = getPrismaClient();
				const result = await executeGoogleSyncUpload(prisma, userId);
				win.webContents.send("daypulse:sync-updated", result);
			} catch (err) {
				console.warn("[DayPulse Desktop] Tray sync notice:", err);
				win.show();
				win.focus();
			}
		},
		() => {
			cleanupAndQuit();
		},
	);

	// 7. Start in-process background reminder scheduler
	startLocalScheduler(win);

	// 8. Ensure UI development server is running in dev mode
	const targetUrl = process.env.APP_URL || "http://localhost:3000/dashboard";
	if (process.env.NODE_ENV !== "production") {
		await ensureDevServerReady();
	}

	// 9. Load URL with robust retry and splash window transition
	updateSplashStatus("Connecting to DayPulse interface...");

	let splashClosed = false;
	const revealWindow = async () => {
		if (splashClosed) return;
		splashClosed = true;
		updateSplashStatus("Workspace ready!");
		await new Promise((r) => setTimeout(r, 150));
		await closeSplashWindow(win);
	};

	win.webContents.once("dom-ready", () => {
		console.log("[DayPulse Desktop] DOM ready - revealing window");
		revealWindow();
	});

	win.once("ready-to-show", () => {
		console.log("[DayPulse Desktop] Window ready to show - revealing window");
		revealWindow();
	});

	// Maximum 20-second failsafe: unconditionally reveal main window
	setTimeout(() => {
		if (!splashClosed) {
			console.log("[DayPulse Desktop] Failsafe timeout reached - revealing window");
			revealWindow();
		}
	}, 20000);

	// Start navigation with retry loop
	const navigateWithRetry = async (maxAttempts = 15) => {
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				console.log(
					`[DayPulse Desktop] Loading URL (attempt ${attempt}/${maxAttempts}): ${targetUrl}`,
				);
				await win.loadURL(targetUrl);
				console.log(`[DayPulse Desktop] UI connected at ${targetUrl}`);
				revealWindow();
				return;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(
					`[DayPulse Desktop] Navigation attempt ${attempt}/${maxAttempts} notice: ${msg}`,
				);
				if (attempt < maxAttempts) {
					await new Promise((r) => setTimeout(r, 1000));
				}
			}
		}

		win.loadURL(
			`data:text/html;charset=utf-8,${encodeURIComponent(`
			<!DOCTYPE html>
			<html>
			<body style="background:#09090b;color:#f4f4f5;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;margin:0">
				<h2 style="margin-bottom:8px;font-weight:600">DayPulse Workspace Connection</h2>
				<p style="color:#a1a1aa;margin-bottom:20px;font-size:14px">Connecting to local UI server at ${targetUrl}...</p>
				<button onclick="window.location.href='${targetUrl}'" style="background:#10b981;color:#09090b;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer">Retry Connection</button>
			</body>
			</html>
		`)}`,
		);
		revealWindow();
	};

	navigateWithRetry();
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
