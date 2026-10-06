import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { app, type NativeImage, nativeImage, shell } from "electron";

export function getWindowIconPath(): string {
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

export function getWindowIcon(): NativeImage {
	const iconPath = getWindowIconPath();
	if (iconPath) {
		try {
			const img = nativeImage.createFromPath(iconPath);
			if (!img.isEmpty()) return img;
		} catch {
			// Continue with fallback
		}
	}
	return nativeImage.createEmpty();
}

export function setupWindowsBranding(): void {
	if (process.platform !== "win32") return;

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
		// Classes registry key registration fallback
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
		// Notification settings registry key fallback
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

		if (fs.existsSync(shortcutPath)) {
			try {
				execSync(`attrib -R "${shortcutPath}"`, { stdio: "ignore" });
			} catch {
				// Unlock shortcut if already read-only
			}
		}

		const shortcutOptions = {
			target: process.execPath,
			args: app.isPackaged ? "" : `"${path.resolve(__dirname, "..")}"`,
			appUserModelId: appId,
			icon: windowIcon,
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
			// Lock shortcut to prevent Electron from wiping icon
		}
	} catch (err) {
		console.warn("[DayPulse Desktop] Shortcut registration notice:", err);
	}
}
