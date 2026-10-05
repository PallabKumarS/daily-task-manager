import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { updateSplashStatus } from "./splash-window.js";

let nextDevProcess: ChildProcess | null = null;

export async function isUrlResponding(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		try {
			const parsed = new URL(url);
			const req = http.get(
				{
					hostname: parsed.hostname,
					port: parsed.port || 80,
					path: parsed.pathname || "/",
					timeout: 800,
				},
				(res) => {
					resolve(res.statusCode !== undefined && res.statusCode < 500);
				},
			);
			req.on("error", () => resolve(false));
			req.on("timeout", () => {
				req.destroy();
				resolve(false);
			});
		} catch {
			resolve(false);
		}
	});
}

export async function ensureDevServerReady(
	targetUrl = "http://localhost:3000",
): Promise<void> {
	const alreadyUp = await isUrlResponding(targetUrl);
	if (alreadyUp) {
		console.log(
			`[DayPulse Desktop] UI server already responsive at ${targetUrl}`,
		);
		return;
	}

	const webDirCandidates = [
		path.resolve(process.cwd(), "web-app"),
		path.resolve(process.cwd(), "..", "web-app"),
		path.resolve(__dirname, "../../web-app"),
		path.resolve(__dirname, "../web-app"),
	];

	let webDir = "";
	for (const candidate of webDirCandidates) {
		if (
			fs.existsSync(candidate) &&
			fs.existsSync(path.join(candidate, "package.json"))
		) {
			webDir = candidate;
			break;
		}
	}

	if (!webDir) {
		console.warn(
			"[DayPulse Desktop] web-app directory not found for auto-launch.",
		);
		return;
	}

	console.log(
		`[DayPulse Desktop] Auto-spawning Next.js dev server in: ${webDir}`,
	);
	updateSplashStatus("Starting Next.js UI development server...");

	const isWin = process.platform === "win32";
	const npmCmd = isWin ? "npm.cmd" : "npm";

	nextDevProcess = spawn(npmCmd, ["run", "dev"], {
		cwd: webDir,
		env: {
			...process.env,
			PORT: "3000",
		},
		stdio: "pipe",
		shell: isWin,
	});

	nextDevProcess.stdout?.on("data", (data) => {
		const out = data.toString().trim();
		if (out.includes("Ready in") || out.includes("compiled")) {
			updateSplashStatus("UI server ready. Compiling workspace...");
		}
	});

	// Poll up to 45 seconds for Next.js to start
	const start = Date.now();
	while (Date.now() - start < 45000) {
		await new Promise((r) => setTimeout(r, 1000));
		if (await isUrlResponding(targetUrl)) {
			console.log(`[DayPulse Desktop] UI server verified at ${targetUrl}`);
			updateSplashStatus("Workspace ready!");
			return;
		}
	}

	console.warn(
		"[DayPulse Desktop] Next.js startup timed out; proceeding to connect.",
	);
}

export function stopDevServer(): void {
	if (nextDevProcess) {
		console.log("[DayPulse Desktop] Stopping spawned Next.js dev process...");
		nextDevProcess.kill("SIGTERM");
		nextDevProcess = null;
	}
}
