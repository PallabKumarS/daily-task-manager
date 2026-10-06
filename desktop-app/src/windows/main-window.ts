import * as path from "node:path";
import { BrowserWindow } from "electron";
import { closeSplashWindow, updateSplashStatus } from "./splash-window.js";
import { getIcoIconPath, getPngIconPath, getWindowIcon } from "./windows-branding.js";

export function createMainWindow(onCloseHide: () => void): BrowserWindow {
	const icoPath = getIcoIconPath();
	const pngPath = getPngIconPath();
	const windowIcon = getWindowIcon();

	// On Windows, icoPath gives native multi-resolution icons (16, 32, 48, 256)
	const effectiveIcon = icoPath || (!windowIcon.isEmpty() ? windowIcon : pngPath || undefined);

	const preloadPath = path.resolve(__dirname, "../preload.js");

	const win = new BrowserWindow({
		width: 1280,
		height: 850,
		minWidth: 920,
		minHeight: 640,
		show: false,
		title: "DayPulse",
		icon: effectiveIcon,
		backgroundColor: "#09090b",
		autoHideMenuBar: true,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	if (icoPath) {
		win.setIcon(icoPath);
	} else if (!windowIcon.isEmpty()) {
		win.setIcon(windowIcon);
	} else if (pngPath) {
		win.setIcon(pngPath);
	}

	win.on("close", (event) => {
		event.preventDefault();
		onCloseHide();
	});

	if (process.env.NODE_ENV !== "production") {
		if (process.argv.includes("--devtools")) {
			win.webContents.openDevTools({ mode: "detach" });
		}

		win.webContents.on("preload-error", (_event, pPath, error) => {
			console.error(`[Preload Error] in ${pPath}:`, error);
		});

		win.webContents.on("render-process-gone", (_event, details) => {
			console.error("[Renderer Process Gone]", details);
		});

		win.webContents.on("did-start-loading", () => {
			console.log("[DayPulse Desktop] WebContents started loading");
		});

		win.webContents.on("did-navigate", (_event, url) => {
			console.log(`[DayPulse Desktop] Navigated to: ${url}`);
		});

		win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
			console.warn(
				`[DayPulse Desktop] Load failed: ${errorDescription} (${errorCode}) at ${validatedURL}`,
			);
		});
	}

	return win;
}

export async function navigateMainWindow(win: BrowserWindow, uiUrl: string): Promise<void> {
	updateSplashStatus("Loading application interface...");

	let attempts = 0;
	const maxAttempts = 15;

	while (attempts < maxAttempts) {
		attempts++;
		try {
			console.log(`[DayPulse Desktop] Connection attempt ${attempts} to: ${uiUrl}`);
			await win.loadURL(uiUrl);

			win.once("ready-to-show", () => {
				closeSplashWindow();
				win.show();
				win.focus();
				console.log("[DayPulse Desktop] Main window presented to user");
			});
			return;
		} catch (err) {
			console.log(
				`[DayPulse Desktop] Attempt ${attempts} unsuccessful, retrying in 1s... (${(err as Error).message})`,
			);
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	// Final attempt fallback
	try {
		await win.loadURL(uiUrl);
		closeSplashWindow();
		win.show();
	} catch (err) {
		console.error("[DayPulse Desktop] Critical: Failed to load URL after multiple attempts:", err);
		closeSplashWindow();
		win.show();
	}
}
