import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceDir = path.resolve(__dirname, "..");

let executable = "electron";
if (process.platform === "win32") {
	const candidates = [
		path.resolve(__dirname, "../../node_modules/electron/dist/DayPulse.exe"),
		path.resolve(__dirname, "../node_modules/electron/dist/DayPulse.exe"),
		path.resolve(__dirname, "../../node_modules/electron/dist/electron.exe"),
		path.resolve(__dirname, "../node_modules/electron/dist/electron.exe"),
	];
	const found = candidates.find((p) => fs.existsSync(p));
	if (found) {
		executable = found;
	}
}

const child = spawn(executable, [workspaceDir, ...process.argv.slice(2)], {
	stdio: "inherit",
	windowsHide: false,
});

child.on("exit", (code) => {
	process.exit(code ?? 0);
});
