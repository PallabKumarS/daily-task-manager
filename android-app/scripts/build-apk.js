import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

function findJava21Home() {
	if (process.env.JAVA_HOME?.includes("21")) {
		return process.env.JAVA_HOME;
	}

	const jdksDir = path.join(os.homedir(), ".gradle", "jdks");
	if (fs.existsSync(jdksDir)) {
		const entries = fs.readdirSync(jdksDir);
		const java21 = entries.find((entry) => entry.includes("-21-"));
		if (java21) {
			return path.join(jdksDir, java21);
		}
	}
	return process.env.JAVA_HOME;
}

const androidDir = path.join(process.cwd(), "android");
const releaseDir = path.join(process.cwd(), "release");
const gradlewCmd = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

if (!fs.existsSync(androidDir)) {
	console.error("Android project directory not found.");
	process.exit(1);
}

const env = { ...process.env };
const java21 = findJava21Home();
if (java21) {
	env.JAVA_HOME = java21;
}

console.log("[DayPulse] Building Android APK...");
execSync(`${gradlewCmd} assembleDebug assembleRelease`, {
	cwd: androidDir,
	stdio: "inherit",
	env,
});

if (!fs.existsSync(releaseDir)) {
	fs.mkdirSync(releaseDir, { recursive: true });
}

const debugApk = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const releaseApk = path.join(
	androidDir,
	"app",
	"build",
	"outputs",
	"apk",
	"release",
	"app-release-unsigned.apk",
);

if (fs.existsSync(debugApk)) {
	fs.copyFileSync(debugApk, path.join(releaseDir, "DayPulse-debug.apk"));
	console.log("[DayPulse] Exported: release/DayPulse-debug.apk");
}

if (fs.existsSync(releaseApk)) {
	fs.copyFileSync(releaseApk, path.join(releaseDir, "DayPulse-release-unsigned.apk"));
	console.log("[DayPulse] Exported: release/DayPulse-release-unsigned.apk");
}
