import * as fs from "node:fs";
import * as path from "node:path";
import { BrowserWindow, shell } from "electron";
import { getAssetPath, getWindowIcon, getWindowIconPath } from "./windows-branding.js";

export function createMainWindow(onCloseHide: () => void): BrowserWindow {
	const iconPath = getWindowIconPath();
	const windowIcon = getWindowIcon();
	const preloadPath = path.resolve(__dirname, "../preload.js");

	const win = new BrowserWindow({
		width: 1280,
		height: 850,
		minWidth: 920,
		minHeight: 640,
		show: true,
		title: "DayPulse — Client UI",
		icon: !windowIcon.isEmpty() ? windowIcon : iconPath || undefined,
		backgroundColor: "#09090b",
		autoHideMenuBar: true,
		frame: false,
		titleBarStyle: "hidden",
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	// Ensure all popups, OAuth windows, and links open strictly in user default browser
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
			shell.openExternal(url);
		}
		return { action: "deny" };
	});

	win.webContents.on("will-navigate", (event, url) => {
		if (!url.startsWith("http://localhost:") && !url.startsWith("file://")) {
			event.preventDefault();
			shell.openExternal(url);
		}
	});

	if (!windowIcon.isEmpty()) {
		win.setIcon(windowIcon);
	} else if (iconPath) {
		win.setIcon(iconPath);
	}

	const emitWindowState = () => {
		if (!win.isDestroyed()) {
			win.webContents.send("window:state-changed", {
				isMaximized: win.isMaximized(),
				isFullScreen: win.isFullScreen(),
			});
		}
	};

	win.on("maximize", emitWindowState);
	win.on("unmaximize", emitWindowState);
	win.on("enter-full-screen", emitWindowState);
	win.on("leave-full-screen", emitWindowState);

	win.on("page-title-updated", (event) => {
		event.preventDefault();
		win.setTitle("DayPulse — Client UI");
	});

	// Directly load splash.html inside mainWindow matching krishan-traders pattern
	const splashPath = getAssetPath("splash.html");
	if (splashPath && fs.existsSync(splashPath)) {
		win.loadFile(splashPath).catch(() => {});
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

		win.webContents.on("did-navigate", (_event, url) => {
			console.log(`[DayPulse Desktop] Navigated to: ${url}`);
		});
	}

	return win;
}

export async function navigateMainWindow(win: BrowserWindow, uiUrl: string): Promise<void> {
	let attempts = 0;
	const maxAttempts = 20;

	while (attempts < maxAttempts) {
		attempts++;
		try {
			console.log(`[DayPulse Desktop] Connecting to: ${uiUrl} (attempt ${attempts})`);
			await win.loadURL(uiUrl);
			console.log("[DayPulse Desktop] UI loaded successfully into main window");
			return;
		} catch (err) {
			console.log(`[DayPulse Desktop] Waiting for server... (${(err as Error).message})`);
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	try {
		await win.loadURL(uiUrl);
	} catch (err) {
		console.error("[DayPulse Desktop] Failed to load URL after attempts:", err);
	}
}
