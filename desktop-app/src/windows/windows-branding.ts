import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { app, type NativeImage, nativeImage, shell } from "electron";

export function getAssetPath(filename: string): string {
	const candidates = [
		path.resolve(__dirname, "../assets", filename),
		path.resolve(__dirname, "../../assets", filename),
		path.resolve(process.cwd(), "desktop-app/assets", filename),
		path.resolve(process.cwd(), "assets", filename),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return "";
}

export function getIcoIconPath(): string {
	return getAssetPath("daypulse.ico") || getAssetPath("favicon.ico");
}

export function getPngIconPath(): string {
	return getAssetPath("logo.png") || getAssetPath("google-app-logo.png");
}

export function getWindowIconPath(): string {
	if (process.platform === "win32") {
		return getIcoIconPath() || getPngIconPath();
	}
	return getPngIconPath() || getIcoIconPath();
}

export function getWindowIcon(): NativeImage {
	const iconPath = getWindowIconPath();
	if (iconPath) {
		try {
			const img = nativeImage.createFromPath(iconPath);
			if (!img.isEmpty()) return img;
		} catch {
			// Ignore
		}
	}
	return nativeImage.createEmpty();
}

export function setupWindowsBranding(): void {
	if (process.platform !== "win32") return;

	const appId = "com.daypulse.tracker";
	app.setAppUserModelId(appId);

	try {
		const icoPath = getIcoIconPath();
		const iconForUri = icoPath || getPngIconPath();

		const programsDir = path.join(
			app.getPath("appData"),
			"Microsoft",
			"Windows",
			"Start Menu",
			"Programs",
		);
		const shortcutPath = path.join(programsDir, "DayPulse.lnk");

		const shortcutOptions = {
			target: process.execPath,
			args: app.isPackaged ? "" : `"${path.resolve(__dirname, "..")}"`,
			appUserModelId: appId,
			icon: icoPath,
			iconIndex: 0,
			description: "DayPulse",
		};

		const op = fs.existsSync(shortcutPath) ? "replace" : "create";
		shell.writeShortcutLink(shortcutPath, op, shortcutOptions);

		if (iconForUri) {
			const classesKey = `HKCU\\Software\\Classes\\AppUserModelId\\${appId}`;
			execFileSync(
				"reg",
				["add", classesKey, "/v", "DisplayName", "/t", "REG_SZ", "/d", "DayPulse", "/f"],
				{ stdio: "ignore" },
			);
			execFileSync(
				"reg",
				["add", classesKey, "/v", "IconUri", "/t", "REG_SZ", "/d", iconForUri, "/f"],
				{ stdio: "ignore" },
			);

			const notifKey = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\\${appId}`;
			execFileSync(
				"reg",
				["add", notifKey, "/v", "DisplayName", "/t", "REG_SZ", "/d", "DayPulse", "/f"],
				{ stdio: "ignore" },
			);
			execFileSync(
				"reg",
				["add", notifKey, "/v", "IconUri", "/t", "REG_SZ", "/d", iconForUri, "/f"],
				{ stdio: "ignore" },
			);
			execFileSync(
				"reg",
				["add", notifKey, "/v", "ShowInActionCenter", "/t", "REG_DWORD", "/d", "1", "/f"],
				{ stdio: "ignore" },
			);
		}
	} catch (err) {
		console.warn("[DayPulse Desktop] Shortcut registration notice:", err);
	}
}
