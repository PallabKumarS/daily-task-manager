import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.platform === "win32") {
	const electronExeCandidates = [
		path.resolve(__dirname, "../../node_modules/electron/dist/electron.exe"),
		path.resolve(__dirname, "../node_modules/electron/dist/electron.exe"),
	];

	const rceditCandidates = [
		path.resolve(__dirname, "../../node_modules/electron-winstaller/vendor/rcedit.exe"),
		path.resolve(__dirname, "../node_modules/electron-winstaller/vendor/rcedit.exe"),
	];

	const iconCandidates = [
		path.resolve(__dirname, "../dist/assets/daypulse.ico"),
		path.resolve(__dirname, "../assets/daypulse.ico"),
		path.resolve(__dirname, "../dist/assets/favicon.ico"),
		path.resolve(__dirname, "../assets/favicon.ico"),
	];

	const electronExe = electronExeCandidates.find((p) => fs.existsSync(p));
	const rceditExe = rceditCandidates.find((p) => fs.existsSync(p));
	const iconPath = iconCandidates.find((p) => fs.existsSync(p));

	if (electronExe && rceditExe && iconPath) {
		const electronDir = path.dirname(electronExe);
		const daypulseExe = path.join(electronDir, "DayPulse.exe");

		try {
			if (!fs.existsSync(daypulseExe)) {
				fs.copyFileSync(electronExe, daypulseExe);
			}
			execFileSync(
				rceditExe,
				[
					daypulseExe,
					"--set-icon",
					iconPath,
					"--set-version-string",
					"FileDescription",
					"DayPulse",
					"--set-version-string",
					"ProductName",
					"DayPulse",
					"--set-version-string",
					"CompanyName",
					"DayPulse",
				],
				{ stdio: "ignore" },
			);
		} catch {
			// Continue
		}

		try {
			execFileSync(
				rceditExe,
				[
					electronExe,
					"--set-icon",
					iconPath,
					"--set-version-string",
					"FileDescription",
					"DayPulse",
					"--set-version-string",
					"ProductName",
					"DayPulse",
					"--set-version-string",
					"CompanyName",
					"DayPulse",
				],
				{ stdio: "ignore" },
			);
		} catch {
			// Continue
		}
	}
}
