import * as path from "node:path";
import { BrowserWindow } from "electron";
import { closeSplashWindow, updateSplashStatus } from "./splash-window.js";
import { getWindowIcon, getWindowIconPath } from "./windows-branding.js";

export function createMainWindow(onCloseHide: () => void): BrowserWindow {
	const iconPath = getWindowIconPath();
	const windowIcon = getWindowIcon();
	const effectiveIcon = !windowIcon.isEmpty() ? windowIcon : iconPath || undefined;

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
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	if (!windowIcon.isEmpty()) {
		win.setIcon(windowIcon);
	} else if (iconPath) {
		win.setIcon(iconPath);
	}

	win.on("close", (event) => {
		event.preventDefault();
		onCloseHide();
	});

	if (process.env.NODE_ENV !== "production") {
		if (process.argv.includes("--devtools")) {
			win.webContents.openDevTools({ mode: "detach" });
		}

		win.webContents.on("preload-error", (_event, preloadPath, error) => {
			console.error(`[Preload Error] in ${preloadPath}:`, error);
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

		win.webContents.on("before-input-event", (event, input) => {
			if (
				input.type === "keyDown" &&
				(input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i"))
			) {
				win.webContents.toggleDevTools();
				event.preventDefault();
			}
		});

		win.webContents.on("console-message", (event: unknown, ...args: unknown[]) => {
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

		win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
			console.error(`[Renderer Load Error] ${errorDescription} (${errorCode}) for ${validatedURL}`);
		});
	}

	return win;
}

export async function navigateWithSplashTransition(
	win: BrowserWindow,
	targetUrl: string,
): Promise<void> {
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
		revealWindow();
	});

	win.once("ready-to-show", () => {
		revealWindow();
	});

	// Failsafe timeout to unconditionally show main window
	setTimeout(() => {
		if (!splashClosed) {
			revealWindow();
		}
	}, 20000);

	const maxAttempts = 15;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await win.loadURL(targetUrl);
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
}
