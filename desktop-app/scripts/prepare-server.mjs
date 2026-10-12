import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "../..");
const webAppDir = path.join(rootDir, "web-app");
const serverDir = path.join(rootDir, "server");
const desktopAppDir = path.join(rootDir, "desktop-app");
const targetServerDist = path.join(desktopAppDir, "server-dist");

console.log("[DayPulse] Preparing Server Distribution for Desktop Packaging...");

// 1. Build Next.js standalone application
console.log("[DayPulse] Building Next.js standalone application...");
execSync("npm run build", {
	cwd: webAppDir,
	stdio: "inherit",
	env: {
		...process.env,
		NEXT_EXPORT: "false",
		CAPACITOR_BUILD: "false",
	},
});

// 2. Build Express API server
console.log("[DayPulse] Building Express API server...");
execSync("npm run build", {
	cwd: serverDir,
	stdio: "inherit",
});

// 3. Clean old server-dist
if (fs.existsSync(targetServerDist)) {
	console.log("[DayPulse] Cleaning previous server-dist...");
	fs.rmSync(targetServerDist, { recursive: true, force: true });
}
fs.mkdirSync(targetServerDist, { recursive: true });

// 4. Prepare Web distribution
const standaloneDir = path.join(webAppDir, ".next/standalone");
const webTarget = path.join(targetServerDist, "web");

if (fs.existsSync(standaloneDir)) {
	console.log("[DayPulse] Copying Next.js standalone bundle (dereferencing symlinks)...");
	fs.cpSync(standaloneDir, webTarget, {
		recursive: true,
		dereference: true,
	});
} else {
	console.error("[DayPulse] ERROR: web-app/.next/standalone not found!");
	process.exit(1);
}

// Copy static and public assets
const staticDir = path.join(webAppDir, ".next/static");
const publicDir = path.join(webAppDir, "public");

const targetStaticSub = path.join(webTarget, "web-app/.next/static");
const targetStaticRoot = path.join(webTarget, ".next/static");
const targetPublicSub = path.join(webTarget, "web-app/public");
const targetPublicRoot = path.join(webTarget, "public");

if (fs.existsSync(staticDir)) {
	fs.cpSync(staticDir, targetStaticSub, { recursive: true });
	fs.cpSync(staticDir, targetStaticRoot, { recursive: true });
}

if (fs.existsSync(publicDir)) {
	fs.cpSync(publicDir, targetPublicSub, { recursive: true });
	fs.cpSync(publicDir, targetPublicRoot, { recursive: true });
}

// Rename web node_modules to vendor (protect from electron-builder prune)
const webNodeModules = path.join(webTarget, "node_modules");
const webVendor = path.join(webTarget, "vendor");
if (fs.existsSync(webNodeModules)) {
	console.log("[DayPulse] Renaming web node_modules to vendor...");
	fs.renameSync(webNodeModules, webVendor);
}

// 5. Prepare API distribution
const apiTarget = path.join(targetServerDist, "api");
fs.mkdirSync(apiTarget, { recursive: true });

const serverDistSrc = path.join(serverDir, "dist");
const serverPrismaSrc = path.join(serverDir, "prisma");

if (fs.existsSync(serverDistSrc)) {
	fs.cpSync(serverDistSrc, path.join(apiTarget, "dist"), { recursive: true });
}

if (fs.existsSync(serverPrismaSrc)) {
	fs.cpSync(serverPrismaSrc, path.join(apiTarget, "prisma"), { recursive: true });
}

// Copy clean database template
const templateDbSrc = path.join(serverDir, "prisma/dev.db");
const templateDbDest = path.join(targetServerDist, "template.db");
if (fs.existsSync(templateDbSrc)) {
	fs.copyFileSync(templateDbSrc, templateDbDest);
}

// Generate package.json for API production runtime
const apiPackageJson = {
	name: "daypulse-api",
	version: "1.0.0",
	type: "module",
	dependencies: {
		"@prisma/client": "^6.4.0",
		bcryptjs: "^3.0.2",
		"cookie-parser": "^1.4.7",
		cors: "^2.8.5",
		dotenv: "^16.4.7",
		express: "^4.21.2",
		jsonwebtoken: "^9.0.2",
		"node-cron": "^3.0.3",
		"socket.io": "^4.8.1",
		zod: "^3.24.2",
	},
};

fs.writeFileSync(
	path.join(apiTarget, "package.json"),
	JSON.stringify(apiPackageJson, null, 2),
	"utf8",
);

console.log("[DayPulse] Installing production dependencies for API...");
execSync("npm install --omit=dev --no-package-lock", {
	cwd: apiTarget,
	stdio: "inherit",
});

console.log("[DayPulse] Copying pre-built Prisma client & query engine binary...");
const rootNodeModules = path.join(rootDir, "node_modules");
fs.cpSync(path.join(rootNodeModules, ".prisma"), path.join(apiTarget, "node_modules/.prisma"), {
	recursive: true,
});
fs.cpSync(path.join(rootNodeModules, "@prisma"), path.join(apiTarget, "node_modules/@prisma"), {
	recursive: true,
});

// Rename api node_modules to vendor (protect from electron-builder prune)
const apiNodeModules = path.join(apiTarget, "node_modules");
const apiVendor = path.join(apiTarget, "vendor");
if (fs.existsSync(apiNodeModules)) {
	console.log("[DayPulse] Renaming api node_modules to vendor...");
	fs.renameSync(apiNodeModules, apiVendor);
}

// 6. Write production coordinator script: server-dist/server.js
const coordinatorScript = `const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");

// 1. Establish User Data and SQLite database
const userDataPath = process.env.USER_DATA_PATH || path.join(__dirname, "data");
if (!fs.existsSync(userDataPath)) {
	fs.mkdirSync(userDataPath, { recursive: true });
}

const dbPath = path.join(userDataPath, "daypulse.db");
const templateDb = path.join(__dirname, "template.db");
if (!fs.existsSync(dbPath) && fs.existsSync(templateDb)) {
	try {
		fs.copyFileSync(templateDb, dbPath);
		console.log("[DayPulse Server] Copied database template to", dbPath);
	} catch (err) {
		console.warn("[DayPulse Server] Template copy warning:", err.message);
	}
}

const dbUrl = "file:" + dbPath.replace(/\\\\/g, "/");
process.env.DATABASE_URL = dbUrl;

// 2. Link vendor directories to node_modules via junctions
const apiDir = path.join(__dirname, "api");
const apiVendor = path.join(apiDir, "vendor");
const apiNodeModules = path.join(apiDir, "node_modules");
if (fs.existsSync(apiVendor) && !fs.existsSync(apiNodeModules)) {
	try {
		fs.symlinkSync(apiVendor, apiNodeModules, "junction");
	} catch (e) {
		console.warn("[DayPulse Server] API junction warning:", e.message);
	}
}

const webDir = path.join(__dirname, "web");
const webVendor = path.join(webDir, "vendor");
const webNodeModules = path.join(webDir, "node_modules");
if (fs.existsSync(webVendor) && !fs.existsSync(webNodeModules)) {
	try {
		fs.symlinkSync(webVendor, webNodeModules, "junction");
	} catch (e) {
		console.warn("[DayPulse Server] Web junction warning:", e.message);
	}
}

// 3. Start Express API server on port 49275
const apiPort = 49275;
const apiScript = path.join(apiDir, "dist/server.js");
let apiProcess = null;

if (fs.existsSync(apiScript)) {
	apiProcess = fork(apiScript, [], {
		cwd: apiDir,
		env: {
			...process.env,
			NODE_ENV: "production",
			PORT: String(apiPort),
			DATABASE_URL: dbUrl,
			ELECTRON_RUN_AS_NODE: "1",
		},
		stdio: ["ignore", "pipe", "pipe", "ipc"],
	});

	if (apiProcess.stdout) apiProcess.stdout.pipe(process.stdout);
	if (apiProcess.stderr) apiProcess.stderr.pipe(process.stderr);
} else {
	console.error("[DayPulse Server] API script not found at", apiScript);
}

// 4. Start Next.js standalone web server on port 49274
const webPort = parseInt(process.env.PORT, 10) || 49274;
const webScriptCandidates = [
	path.join(webDir, "web-app/server.js"),
	path.join(webDir, "server.js"),
];

let webScript = null;
for (const cand of webScriptCandidates) {
	if (fs.existsSync(cand)) {
		webScript = cand;
		break;
	}
}

let webProcess = null;
if (webScript) {
	const webCwd = path.dirname(webScript);
	webProcess = fork(webScript, [], {
		cwd: webCwd,
		env: {
			...process.env,
			NODE_ENV: "production",
			PORT: String(webPort),
			HOSTNAME: "127.0.0.1",
			SERVER_INTERNAL_URL: "http://127.0.0.1:" + apiPort,
			NEXT_PUBLIC_API_URL: "http://127.0.0.1:" + apiPort + "/api/v1",
			ELECTRON_RUN_AS_NODE: "1",
		},
		stdio: ["ignore", "pipe", "pipe", "ipc"],
	});

	if (webProcess.stdout) webProcess.stdout.pipe(process.stdout);
	if (webProcess.stderr) webProcess.stderr.pipe(process.stderr);
} else {
	console.error("[DayPulse Server] Web standalone script not found in", webScriptCandidates);
}

function handleCleanup() {
	if (apiProcess) {
		try { apiProcess.kill(); } catch {}
		apiProcess = null;
	}
	if (webProcess) {
		try { webProcess.kill(); } catch {}
		webProcess = null;
	}
	process.exit(0);
}

process.on("SIGINT", handleCleanup);
process.on("SIGTERM", handleCleanup);
process.on("exit", handleCleanup);
`;

fs.writeFileSync(path.join(targetServerDist, "server.js"), coordinatorScript, "utf8");

const cleanupJunction = (p) => {
	if (fs.existsSync(p)) {
		try {
			fs.unlinkSync(p);
		} catch {}
	}
};
cleanupJunction(path.join(targetServerDist, "api/node_modules"));
cleanupJunction(path.join(targetServerDist, "web/node_modules"));
if (fs.existsSync(path.join(targetServerDist, "data"))) {
	fs.rmSync(path.join(targetServerDist, "data"), { recursive: true, force: true });
}

console.log("[DayPulse] Successfully created server-dist at:", targetServerDist);
