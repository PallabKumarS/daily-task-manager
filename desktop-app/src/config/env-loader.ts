import * as fs from "node:fs";
import * as path from "node:path";
import { app } from "electron";

export function parseEnvContent(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	const lines = content.split(/\r?\n/);

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const eqIdx = line.indexOf("=");
		if (eqIdx === -1) continue;

		const key = line.slice(0, eqIdx).trim();
		let val = line.slice(eqIdx + 1).trim();

		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
			val = val.slice(1, -1);
		}

		if (key) {
			result[key] = val;
		}
	}

	return result;
}

export function loadDesktopEnv(): void {
	const candidates: string[] = [];

	try {
		const userDataDir = app.getPath("userData");
		candidates.push(path.join(userDataDir, ".env"));
	} catch {
		// app may not be ready yet
	}

	candidates.push(
		path.resolve(process.cwd(), ".env"),
		path.resolve(process.cwd(), "..", ".env"),
		path.resolve(__dirname, "../../../.env"),
		path.resolve(__dirname, "../../.env"),
	);

	for (const envPath of candidates) {
		if (fs.existsSync(envPath)) {
			try {
				const content = fs.readFileSync(envPath, "utf-8");
				const parsed = parseEnvContent(content);
				for (const [key, val] of Object.entries(parsed)) {
					if (!process.env[key]) {
						process.env[key] = val;
					}
				}
			} catch (err) {
				console.warn(`[DayPulse Env] Could not load ${envPath}:`, err);
			}
		}
	}
}
