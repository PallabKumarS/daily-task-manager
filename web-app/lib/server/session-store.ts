import * as fs from "node:fs";
import * as path from "node:path";

interface PersistedSession {
	userId: string;
	signedInAt: string;
}

let activeUserId: string | null = null;
let sessionFilePath: string | null = null;

export function configureSessionStore(dataDir: string): void {
	sessionFilePath = path.join(dataDir, "session.json");
}

export function readPersistedSessionUserId(): string | null {
	if (!sessionFilePath || !fs.existsSync(sessionFilePath)) return null;
	try {
		const parsed = JSON.parse(
			fs.readFileSync(sessionFilePath, "utf8"),
		) as Partial<PersistedSession>;
		return typeof parsed.userId === "string" && parsed.userId ? parsed.userId : null;
	} catch {
		return null;
	}
}

export function getActiveUserId(): string | null {
	return activeUserId;
}

/**
 * Marks a user as signed in. The session is persisted so the desktop app
 * reopens straight into the workspace until the user explicitly signs out.
 */
export function startSession(userId: string): void {
	activeUserId = userId;
	if (!sessionFilePath) return;
	try {
		const payload: PersistedSession = {
			userId,
			signedInAt: new Date().toISOString(),
		};
		fs.writeFileSync(sessionFilePath, JSON.stringify(payload), "utf8");
	} catch (err) {
		console.warn("[DayPulse Session] Failed to persist session:", err);
	}
}

export function restoreSession(userId: string | null): void {
	activeUserId = userId;
}

export function endSession(): void {
	activeUserId = null;
	if (!sessionFilePath || !fs.existsSync(sessionFilePath)) return;
	try {
		fs.unlinkSync(sessionFilePath);
	} catch (err) {
		console.warn("[DayPulse Session] Failed to clear session file:", err);
	}
}
