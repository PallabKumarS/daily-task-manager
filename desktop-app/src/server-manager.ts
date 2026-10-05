import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

let serverProcess: ChildProcess | null = null;

async function isServerRunning(port = 5000): Promise<boolean> {
	return new Promise((resolve) => {
		const req = http.get(
			`http://localhost:${port}/health`,
			{ timeout: 1000 },
			(res) => {
				resolve(res.statusCode === 200);
			},
		);
		req.on("error", () => resolve(false));
		req.on("timeout", () => {
			req.destroy();
			resolve(false);
		});
	});
}

export async function ensureServerRunning(port = 5000): Promise<void> {
	const alreadyRunning = await isServerRunning(port);
	if (alreadyRunning) {
		console.log(
			`[DayPulse Desktop] Core server already active on port ${port}`,
		);
		return;
	}

	const serverDirCandidates = [
		path.resolve(process.cwd(), "server"),
		path.resolve(process.cwd(), "..", "server"),
		path.resolve(__dirname, "../../server"),
		path.resolve(__dirname, "../server"),
	];

	let serverDir = "";
	for (const candidate of serverDirCandidates) {
		if (
			fs.existsSync(candidate) &&
			fs.existsSync(path.join(candidate, "package.json"))
		) {
			serverDir = candidate;
			break;
		}
	}

	if (!serverDir) {
		console.warn(
			"[DayPulse Desktop] Could not locate server directory. Expecting external server.",
		);
		return;
	}

	console.log(`[DayPulse Desktop] Spawning internal server from: ${serverDir}`);

	const isWin = process.platform === "win32";
	const npmCmd = isWin ? "npm.cmd" : "npm";

	const hasDist = fs.existsSync(path.join(serverDir, "dist", "server.js"));
	const npmScript = hasDist ? "start" : "dev";

	serverProcess = spawn(npmCmd, ["run", npmScript], {
		cwd: serverDir,
		env: {
			...process.env,
			PORT: String(port),
			NODE_ENV: "development",
		},
		stdio: "pipe",
		shell: isWin,
	});

	serverProcess.stdout?.on("data", (data) => {
		const out = data.toString().trim();
		if (out) console.log(`[Server] ${out}`);
	});

	serverProcess.stderr?.on("data", (data) => {
		const err = data.toString().trim();
		if (err) console.error(`[Server Error] ${err}`);
	});

	serverProcess.on("close", (code) => {
		console.log(`[DayPulse Desktop] Server process exited with code ${code}`);
		serverProcess = null;
	});

	// Wait up to 15 seconds for server to be responsive
	const start = Date.now();
	while (Date.now() - start < 15000) {
		await new Promise((r) => setTimeout(r, 600));
		if (await isServerRunning(port)) {
			console.log(
				`[DayPulse Desktop] Server successfully verified on port ${port}`,
			);
			return;
		}
	}

	console.warn(
		"[DayPulse Desktop] Server startup probe timed out; proceeding with launch.",
	);
}

export function stopServer(): void {
	if (serverProcess) {
		console.log("[DayPulse Desktop] Terminating internal server process...");
		serverProcess.kill("SIGTERM");
		serverProcess = null;
	}
}
