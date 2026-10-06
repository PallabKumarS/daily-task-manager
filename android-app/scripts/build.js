import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "out");
const androidDir = path.join(rootDir, "android");

// Ensure web assets folder exists for Capacitor webDir target
if (!fs.existsSync(outDir)) {
	fs.mkdirSync(outDir, { recursive: true });
	const placeholderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>DayPulse</title>
</head>
<body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <p>DayPulse Mobile Workspace</p>
</body>
</html>`;
	fs.writeFileSync(path.join(outDir, "index.html"), placeholderHtml, "utf-8");
}

if (fs.existsSync(androidDir)) {
	console.log("[DayPulse Android] Syncing native Android platform...");
	try {
		execSync("npx cap sync android", { stdio: "inherit" });
	} catch (err) {
		console.warn("[DayPulse Android] Capacitor sync notice:", err);
	}
} else {
	console.log("[DayPulse Android] Capacitor workspace ready for native platform initialization.");
}
