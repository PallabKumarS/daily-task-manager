const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork, spawn, execSync } = require("child_process");
const http = require("http");

let backendProcess = null;

function startServer(mainWindow) {
	const isDev = !app.isPackaged;

	if (isDev) {
		const devUrl = process.env.APP_URL || "http://localhost:3005/dashboard";
		const devPort = 3005;
		const checkUrl = `http://127.0.0.1:${devPort}/dashboard`;
		let retryCount = 0;
		let spawned = false;

		const tryLoadDev = () => {
			http
				.get(checkUrl, (_res) => {
					mainWindow.loadURL(devUrl);
					mainWindow.focus();
				})
				.on("error", () => {
					if (!spawned) {
						spawned = true;
						const webAppDir = path.resolve(__dirname, "../../web-app");
						if (fs.existsSync(path.join(webAppDir, "package.json"))) {
							const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
							backendProcess = spawn(npmCmd, ["run", "dev"], {
								cwd: webAppDir,
								stdio: "inherit",
								shell: true,
							});
						}
					}
					retryCount++;
					if (retryCount < 120) {
						setTimeout(tryLoadDev, 1000);
					} else {
						console.error("[DayPulse Desktop] Dev server startup timed out after 120s");
					}
				});
		};

		tryLoadDev();
		return;
	}

	const webPort = 49274;
	const userDataPath = app.getPath("userData");
	const serverLogPath = path.join(userDataPath, "server_error.log");

	if (fs.existsSync(serverLogPath)) {
		try {
			fs.unlinkSync(serverLogPath);
		} catch {}
	}

	const candidatePaths = [
		path.join(process.resourcesPath, "server-dist/server.js"),
		path.join(__dirname, "../server-dist/server.js"),
	];

	let serverScriptPath = null;
	for (const candidate of candidatePaths) {
		if (fs.existsSync(candidate)) {
			serverScriptPath = candidate;
			break;
		}
	}

	if (!serverScriptPath) {
		console.error("[DayPulse Desktop] ERROR: server.js not found in candidates:", candidatePaths);
		return;
	}

	const envCandidates = [
		path.join(__dirname, "../../.env"),
		path.join(__dirname, "../.env"),
		path.join(userDataPath, ".env"),
	];
	for (const envFile of envCandidates) {
		if (fs.existsSync(envFile)) {
			try {
				const content = fs.readFileSync(envFile, "utf8");
				for (const line of content.split(/\r?\n/)) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith("#")) continue;
					const eqIdx = trimmed.indexOf("=");
					if (eqIdx > 0) {
						const k = trimmed.slice(0, eqIdx).trim();
						const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
						if (!process.env[k]) {
							process.env[k] = v;
						}
					}
				}
			} catch {}
		}
	}

	backendProcess = fork(serverScriptPath, [], {
		env: {
			...process.env,
			NODE_ENV: "production",
			PORT: String(webPort),
			GOOGLE_CLIENT_ID_DESKTOP: process.env.GOOGLE_CLIENT_ID_DESKTOP,
			GOOGLE_CLIENT_SECRET_DESKTOP: process.env.GOOGLE_CLIENT_SECRET_DESKTOP,
			GOOGLE_REDIRECT_URI:
				process.env.GOOGLE_REDIRECT_URI ||
				`http://localhost:${webPort}/api/v1/sync/google/callback`,
			USER_DATA_PATH: userDataPath,
			ELECTRON_RUN_AS_NODE: "1",
		},
		stdio: ["ignore", "pipe", "pipe", "ipc"],
	});

	const logStream = fs.createWriteStream(serverLogPath, { flags: "a" });
	if (backendProcess.stdout) backendProcess.stdout.pipe(logStream);
	if (backendProcess.stderr) backendProcess.stderr.pipe(logStream);

	const startupUrl = `http://127.0.0.1:${webPort}/dashboard`;
	let retryCount = 0;

	const checkServer = () => {
		http
			.get(startupUrl, (_res) => {
				mainWindow.loadURL(startupUrl);
				mainWindow.focus();
			})
			.on("error", (_err) => {
				retryCount++;
				if (retryCount < 120) {
					setTimeout(checkServer, 500);
				} else {
					console.error("[DayPulse Desktop] Server startup timed out after 60s");
				}
			});
	};

	setTimeout(checkServer, 1000);
}

function stopServer() {
	if (backendProcess) {
		try {
			if (process.platform === "win32" && backendProcess.pid) {
				try {
					execSync(`taskkill /pid ${backendProcess.pid} /T /F`);
				} catch {}
			} else {
				backendProcess.kill();
			}
		} catch {}
		backendProcess = null;
	}
}

module.exports = { startServer, stopServer };
