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

const rootDir = process.cwd();
const webAppDir = path.resolve(rootDir, "..", "web-app");
const androidDir = path.join(rootDir, "android");
const releaseDir = path.join(rootDir, "release");
const gradlewCmd = process.platform === "win32" ? "gradlew.bat" : "./gradlew";

if (!fs.existsSync(androidDir)) {
	console.error("[DayPulse] Android project directory not found.");
	process.exit(1);
}

// 1. Build and export web-app into android-app/out
if (fs.existsSync(webAppDir)) {
	console.log("[DayPulse] Exporting static web application for Android...");
	execSync("npm run build", {
		cwd: webAppDir,
		stdio: "inherit",
		env: {
			...process.env,
			NEXT_EXPORT: "true",
			CAPACITOR_BUILD: "true",
		},
	});
} else {
	console.warn("[DayPulse] Web-app directory not found, using existing out/ folder.");
}

// 2. Sync Capacitor
console.log("[DayPulse] Syncing Capacitor native assets...");
execSync("npx cap sync android", {
	cwd: rootDir,
	stdio: "inherit",
});

// 3. Assemble Android APKs with Java 21
const env = { ...process.env };
const java21 = findJava21Home();
if (java21) {
	env.JAVA_HOME = java21;
}

console.log("[DayPulse] Assembling Android APKs (Debug and Signed Release)...");
execSync(`${gradlewCmd} assembleDebug assembleRelease`, {
	cwd: androidDir,
	stdio: "inherit",
	env,
});

if (!fs.existsSync(releaseDir)) {
	fs.mkdirSync(releaseDir, { recursive: true });
}

const debugApk = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const signedReleaseApk = path.join(
	androidDir,
	"app",
	"build",
	"outputs",
	"apk",
	"release",
	"app-release.apk",
);
const unsignedReleaseApk = path.join(
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

if (fs.existsSync(signedReleaseApk)) {
	fs.copyFileSync(signedReleaseApk, path.join(releaseDir, "DayPulse-release.apk"));
	console.log("[DayPulse] Exported: release/DayPulse-release.apk (Signed)");
} else if (fs.existsSync(unsignedReleaseApk)) {
	fs.copyFileSync(unsignedReleaseApk, path.join(releaseDir, "DayPulse-release-unsigned.apk"));
	console.log("[DayPulse] Exported: release/DayPulse-release-unsigned.apk");
}
