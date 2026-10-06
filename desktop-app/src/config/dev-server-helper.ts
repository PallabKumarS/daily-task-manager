import { type ChildProcess, execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { updateSplashStatus } from "../windows/splash-window.js";

let nextDevProcess: ChildProcess | null = null;

export async function isUrlResponding(url: string, timeoutMs = 3000): Promise<boolean> {
	return new Promise((resolve) => {
		try {
			const parsed = new URL(url);
			const req = http.get(
				{
					hostname: parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname,
					port: parsed.port || 80,
					path: parsed.pathname || "/",
					timeout: timeoutMs,
				},
				(res) => {
					res.resume();
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

function cleanStalePortProcesses(port = 3000): void {
	if (process.platform !== "win32") return;
	try {
		const stdout = execSync(`netstat -ano | findstr ":${port}"`, {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		const lines = stdout.trim().split("\n");
		for (const line of lines) {
			const parts = line.trim().split(/\s+/);
			const state = parts[3];
			const pid = parts[parts.length - 1];
			if (state === "LISTENING" && pid && pid !== "0" && pid !== String(process.pid)) {
				console.log(`[DayPulse Desktop] Cleaning stale process (PID ${pid}) on port ${port}...`);
				try {
					execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
				} catch {
					// Ignore if already exited
				}
			}
		}
		// Give Windows TCP stack a brief moment to release socket
		execSync("powershell -Command Start-Sleep -Milliseconds 400", {
			stdio: "ignore",
		});
	} catch {
		// Port was not in use
	}
}

export async function ensureDevServerReady(): Promise<void> {
	const healthUrl = "http://127.0.0.1:3000/api/health";
	const alreadyUp = await isUrlResponding(healthUrl, 2000);
	if (alreadyUp) {
		console.log(`[DayPulse Desktop] UI server verified at ${healthUrl}`);
		return;
	}

	cleanStalePortProcesses(3000);

	const webDirCandidates = [
		path.resolve(process.cwd(), "web-app"),
		path.resolve(process.cwd(), "..", "web-app"),
		path.resolve(__dirname, "../../../web-app"),
		path.resolve(__dirname, "../../web-app"),
	];

	let webDir = "";
	for (const candidate of webDirCandidates) {
		if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, "package.json"))) {
			webDir = candidate;
			break;
		}
	}

	if (!webDir) {
		console.warn("[DayPulse Desktop] web-app directory not found for auto-launch.");
		return;
	}

	console.log(`[DayPulse Desktop] Auto-spawning Next.js dev server in: ${webDir}`);
	updateSplashStatus("Starting Next.js UI development server...");

	const isWin = process.platform === "win32";
	const npmCmd = isWin ? "npm.cmd" : "npm";

	nextDevProcess = spawn(npmCmd, ["run", "dev"], {
		cwd: webDir,
		env: {
			...process.env,
			PORT: "3000",
		},
		stdio: ["ignore", "pipe", "pipe"],
		shell: isWin,
	});

	nextDevProcess.stdout?.on("data", (data: Buffer) => {
		const out = data.toString();
		process.stdout.write(`[Next.js Dev] ${out}`);
		if (out.includes("Ready in") || out.includes("compiled")) {
			updateSplashStatus("UI server ready. Compiling workspace...");
		}
	});

	nextDevProcess.stderr?.on("data", (data: Buffer) => {
		const err = data.toString();
		process.stderr.write(`[Next.js Dev (err)] ${err}`);
	});

	nextDevProcess.on("exit", (code) => {
		if (code !== null && code !== 0) {
			console.warn(`[DayPulse Desktop] Next.js dev server exited with code ${code}`);
		}
	});

	// Poll up to 30 seconds for Next.js to start
	const start = Date.now();
	while (Date.now() - start < 30000) {
		await new Promise((r) => setTimeout(r, 800));
		if (await isUrlResponding(healthUrl, 1500)) {
			console.log(`[DayPulse Desktop] UI server responsive at ${healthUrl}`);
			updateSplashStatus("Workspace ready!");
			return;
		}
	}

	console.warn("[DayPulse Desktop] Next.js startup timed out; proceeding to connect.");
}

export function stopDevServer(): void {
	if (nextDevProcess?.pid) {
		console.log(
			`[DayPulse Desktop] Terminating Next.js process tree (PID ${nextDevProcess.pid})...`,
		);
		try {
			if (process.platform === "win32") {
				execSync(`taskkill /pid ${nextDevProcess.pid} /T /F`, {
					stdio: "ignore",
				});
			} else {
				process.kill(-nextDevProcess.pid, "SIGTERM");
			}
		} catch {
			// Process tree already terminated
		}
		nextDevProcess = null;
	}
	cleanStalePortProcesses(3000);
	cleanStalePortProcesses(5000);
}
