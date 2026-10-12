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
	execSync("npm run export:android", {
		cwd: webAppDir,
		stdio: "inherit",
	});
} else {
	console.warn("[DayPulse] Web-app directory not found, using existing out/ folder.");
}

// 2. Generate Android icons and splash assets
const generateIconsScript = path.join(rootDir, "scripts", "generate-icons.mjs");
if (fs.existsSync(generateIconsScript)) {
	console.log("[DayPulse] Generating Android launcher icons and splash assets...");
	execSync(`node "${generateIconsScript}"`, { stdio: "inherit" });
}

// 3. Sync Capacitor
console.log("[DayPulse] Syncing Capacitor native assets...");
execSync("npx cap sync android", {
	cwd: rootDir,
	stdio: "inherit",
});

// 4. Assemble Android APKs with Java 21

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

function findApkSigner() {
	const sdkCandidates = [
		process.env.ANDROID_HOME,
		process.env.ANDROID_SDK_ROOT,
		path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
		"C:\\Program Files (x86)\\Android\\android-sdk",
		"C:\\Android\\android-sdk",
	].filter(Boolean);

	for (const sdk of sdkCandidates) {
		const buildToolsDir = path.join(sdk, "build-tools");
		if (fs.existsSync(buildToolsDir)) {
			const versions = fs.readdirSync(buildToolsDir).sort().reverse();
			for (const version of versions) {
				const candidate = path.join(
					buildToolsDir,
					version,
					process.platform === "win32" ? "apksigner.bat" : "apksigner",
				);
				if (fs.existsSync(candidate)) {
					return candidate;
				}
			}
		}
	}
	return undefined;
}

if (fs.existsSync(debugApk)) {
	fs.copyFileSync(debugApk, path.join(releaseDir, "DayPulse-debug.apk"));
	console.log("[DayPulse] Exported: release/DayPulse-debug.apk");
}

const targetReleaseApk = path.join(releaseDir, "DayPulse-release.apk");
if (fs.existsSync(signedReleaseApk)) {
	fs.copyFileSync(signedReleaseApk, targetReleaseApk);
	console.log("[DayPulse] Exported: release/DayPulse-release.apk (Signed)");
} else if (fs.existsSync(unsignedReleaseApk)) {
	fs.copyFileSync(unsignedReleaseApk, path.join(releaseDir, "DayPulse-release-unsigned.apk"));
	console.log("[DayPulse] Exported: release/DayPulse-release-unsigned.apk");
}

if (fs.existsSync(targetReleaseApk)) {
	const apkSigner = findApkSigner();
	const keystore = path.join(androidDir, "app", "release.keystore");
	if (apkSigner && fs.existsSync(keystore)) {
		try {
			console.log("[DayPulse] Verifying and applying v1+v2+v3 signatures with apksigner...");
			execSync(
				`"${apkSigner}" sign --ks "${keystore}" --ks-pass pass:daypulse123 --key-pass pass:daypulse123 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true "${targetReleaseApk}"`,
				{ stdio: "inherit" },
			);
			execSync(`"${apkSigner}" verify --verbose "${targetReleaseApk}"`, {
				stdio: "inherit",
			});
		} catch (e) {
			console.warn("[DayPulse] apksigner verification notice:", e.message);
		}
	}
}
