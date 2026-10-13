import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "../..");
const webAppDir = path.join(rootDir, "web-app");
const desktopAppDir = path.join(rootDir, "desktop-app");
const targetServerDist = path.join(desktopAppDir, "server-dist");

console.log("[DayPulse Desktop] Preparing Single-Process Standalone Server Distribution...");

// 1. Build Next.js standalone application (includes all API route handlers and Prisma)
console.log("[DayPulse Desktop] Building Next.js standalone application...");
execSync("npx next build", {
	cwd: webAppDir,
	stdio: "inherit",
	env: {
		...process.env,
		NEXT_EXPORT: "false",
		CAPACITOR_BUILD: "false",
	},
});

// 2. Clean previous server-dist
if (fs.existsSync(targetServerDist)) {
	console.log("[DayPulse Desktop] Cleaning previous server-dist...");
	fs.rmSync(targetServerDist, { recursive: true, force: true });
}
fs.mkdirSync(targetServerDist, { recursive: true });

// 3. Copy Next.js standalone bundle (dereferencing symlinks)
const standaloneDir = path.join(webAppDir, ".next/standalone");
if (!fs.existsSync(standaloneDir)) {
	console.error("[DayPulse Desktop] ERROR: web-app/.next/standalone not found!");
	process.exit(1);
}

console.log("[DayPulse Desktop] Copying standalone bundle with symlink dereferencing...");
fs.cpSync(standaloneDir, targetServerDist, {
	recursive: true,
	dereference: true,
});

// 4. Copy static assets and public directory
const staticDir = path.join(webAppDir, ".next/static");
const publicDir = path.join(webAppDir, "public");

const staticTargets = [
	path.join(targetServerDist, ".next/static"),
	path.join(targetServerDist, "web-app/.next/static"),
];

for (const target of staticTargets) {
	if (fs.existsSync(staticDir)) {
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.cpSync(staticDir, target, { recursive: true });
	}
}

const publicTargets = [
	path.join(targetServerDist, "public"),
	path.join(targetServerDist, "web-app/public"),
];

for (const target of publicTargets) {
	if (fs.existsSync(publicDir)) {
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.cpSync(publicDir, target, { recursive: true });
	}
}

// 5. Copy Prisma schema and database template
const prismaSrc = path.join(webAppDir, "prisma");
if (fs.existsSync(prismaSrc)) {
	fs.cpSync(prismaSrc, path.join(targetServerDist, "prisma"), { recursive: true });
	fs.cpSync(prismaSrc, path.join(targetServerDist, "web-app/prisma"), { recursive: true });
}

const devDbCandidate = path.join(rootDir, "server/prisma/dev.db");
if (fs.existsSync(devDbCandidate)) {
	fs.copyFileSync(devDbCandidate, path.join(targetServerDist, "template.db"));
}

// 6. Ensure Prisma Client and Query Engine binaries are copied
const candidateNodeModules = [
	path.join(webAppDir, "node_modules"),
	path.join(rootDir, "node_modules"),
];

for (const baseNm of candidateNodeModules) {
	const dotPrisma = path.join(baseNm, ".prisma");
	const atPrisma = path.join(baseNm, "@prisma");

	const destDirs = [
		path.join(targetServerDist, "node_modules"),
		path.join(targetServerDist, "web-app/node_modules"),
	];

	for (const destNm of destDirs) {
		if (fs.existsSync(dotPrisma)) {
			fs.mkdirSync(path.join(destNm, ".prisma"), { recursive: true });
			fs.cpSync(dotPrisma, path.join(destNm, ".prisma"), { recursive: true });
		}
		if (fs.existsSync(atPrisma)) {
			fs.mkdirSync(path.join(destNm, "@prisma"), { recursive: true });
			fs.cpSync(atPrisma, path.join(destNm, "@prisma"), { recursive: true });
		}
	}
}

// 7. Rename node_modules to vendor (protect from electron-builder prune)
const nmPaths = [
	{
		src: path.join(targetServerDist, "node_modules"),
		dest: path.join(targetServerDist, "vendor"),
	},
	{
		src: path.join(targetServerDist, "web-app/node_modules"),
		dest: path.join(targetServerDist, "web-app/vendor"),
	},
];

for (const { src, dest } of nmPaths) {
	if (fs.existsSync(src)) {
		console.log(
			`[DayPulse Desktop] Renaming ${path.basename(path.dirname(src)) || "root"}/node_modules to vendor...`,
		);
		fs.renameSync(src, dest);
	}
}

// 8. Generate production coordinator script server.js
const runnerScript = `const path = require("path");
const fs = require("fs");

const userDataPath = process.env.USER_DATA_PATH || path.join(__dirname, "data");
if (!fs.existsSync(userDataPath)) {
	fs.mkdirSync(userDataPath, { recursive: true });
}

const dbPath = path.join(userDataPath, "daypulse.db");
const templateDb = path.join(__dirname, "template.db");
if (!fs.existsSync(dbPath) && fs.existsSync(templateDb)) {
	try {
		fs.copyFileSync(templateDb, dbPath);
		console.log("[DayPulse Server] Initialized database from template:", dbPath);
	} catch (err) {
		console.warn("[DayPulse Server] Template copy notice:", err.message);
	}
}

process.env.USER_DATA_PATH = userDataPath;
process.env.DATABASE_URL = "file:" + dbPath.replace(/\\\\/g, "/");
if (!process.env.JWT_SECRET) {
	process.env.JWT_SECRET = "daypulse-desktop-jwt-secret-standalone-2026";
}
if (!process.env.TOKEN_ENCRYPTION_SECRET) {
	process.env.TOKEN_ENCRYPTION_SECRET = "daypulse-desktop-aes-gcm-secret-key-32-bytes";
}
if (!process.env.GOOGLE_REDIRECT_URI) {
	process.env.GOOGLE_REDIRECT_URI = "http://localhost:49274/api/v1/sync/google/callback";
}

function linkVendor(base) {
	const vendor = path.join(base, "vendor");
	const nodeModules = path.join(base, "node_modules");
	if (fs.existsSync(vendor) && !fs.existsSync(nodeModules)) {
		try {
			fs.symlinkSync(vendor, nodeModules, "junction");
		} catch (e) {}
	}
}

linkVendor(__dirname);
linkVendor(path.join(__dirname, "web-app"));

const port = parseInt(process.env.PORT, 10) || 49274;
process.env.PORT = String(port);
process.env.HOSTNAME = "127.0.0.1";
process.env.NODE_ENV = "production";

const candidates = [
	path.join(__dirname, "web-app/server.js"),
	path.join(__dirname, "server-standalone.js"),
];

let targetScript = null;
for (const cand of candidates) {
	if (fs.existsSync(cand)) {
		targetScript = cand;
		break;
	}
}

if (!targetScript) {
	console.error("[DayPulse Server] ERROR: Standalone server script not found in:", candidates);
	process.exit(1);
}

process.chdir(path.dirname(targetScript));
require(targetScript);
`;

// If standalone created a root server.js, rename it so runnerScript can be server.js
const standaloneRootServer = path.join(targetServerDist, "server.js");
if (fs.existsSync(standaloneRootServer)) {
	fs.renameSync(standaloneRootServer, path.join(targetServerDist, "server-standalone.js"));
}

fs.writeFileSync(path.join(targetServerDist, "server.js"), runnerScript, "utf8");

// Cleanup leftover junctions
const cleanupJunction = (p) => {
	if (fs.existsSync(p)) {
		try {
			fs.unlinkSync(p);
		} catch {}
	}
};
cleanupJunction(path.join(targetServerDist, "node_modules"));
cleanupJunction(path.join(targetServerDist, "web-app/node_modules"));

console.log(
	"[DayPulse Desktop] Successfully generated single-process server-dist at:",
	targetServerDist,
);
