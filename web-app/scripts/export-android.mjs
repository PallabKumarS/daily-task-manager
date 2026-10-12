import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAppDir = path.resolve(__dirname, "..");
const apiDir = path.join(webAppDir, "app", "api");
const apiTempDir = path.join(webAppDir, "app", "_api_temp");

console.log("[DayPulse] Exporting Web Application for Android...");

let didStashApi = false;
try {
	if (fs.existsSync(apiDir)) {
		fs.renameSync(apiDir, apiTempDir);
		didStashApi = true;
	}

	execSync("npx next build", {
		cwd: webAppDir,
		stdio: "inherit",
		env: {
			...process.env,
			NEXT_EXPORT: "true",
			CAPACITOR_BUILD: "true",
		},
	});
	console.log("[DayPulse] Successfully exported static bundle to android-app/out");
} finally {
	if (didStashApi && fs.existsSync(apiTempDir)) {
		fs.renameSync(apiTempDir, apiDir);
	}
}
