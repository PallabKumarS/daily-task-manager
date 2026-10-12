const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const http = require("http");

let backendProcess = null;

function startServer(mainWindow) {
	const isDev = !app.isPackaged;

	if (isDev) {
		const devUrl = process.env.APP_URL || "http://localhost:3005/dashboard";
		mainWindow.loadURL(devUrl);
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

	backendProcess = fork(serverScriptPath, [], {
		env: {
			...process.env,
			NODE_ENV: "production",
			PORT: String(webPort),
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
			backendProcess.kill();
		} catch {}
		backendProcess = null;
	}
}

module.exports = { startServer, stopServer };
