import type { BrowserWindow } from "electron";
import { executeGoogleSyncUpload } from "../db/google-sync.js";
import { getCurrentUserId, getPrismaClient } from "../db/prisma-client.js";

let syncTimer: NodeJS.Timeout | null = null;
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // Check hourly
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function triggerDailyAutoSync(
	mainWindow?: BrowserWindow | null,
): Promise<{ success: boolean; message: string; lastSyncAt?: string }> {
	const userId = getCurrentUserId();
	if (!userId) {
		return { success: false, message: "No active user session found" };
	}

	const prisma = getPrismaClient();

	const googleConn = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	if (!googleConn?.encryptedAccess) {
		return { success: false, message: "Google Drive is not connected for this workspace" };
	}

	try {
		const res = await executeGoogleSyncUpload(prisma, userId);
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("daypulse:sync-updated", res);
		}
		console.log("[DayPulse AutoSync] Automated cloud synchronization completed successfully");
		return res;
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Automatic cloud sync failed";
		console.warn("[DayPulse AutoSync] Synchronization attempt notice:", msg);
		return { success: false, message: msg };
	}
}

async function performScheduledSyncCheck(mainWindow: BrowserWindow): Promise<void> {
	const userId = getCurrentUserId();
	if (!userId) return;

	try {
		const prisma = getPrismaClient();
		const googleConn = await prisma.googleConnection.findUnique({
			where: { userId },
		});

		if (!googleConn?.encryptedAccess) {
			return;
		}

		const now = Date.now();
		const lastSyncTime = googleConn.lastSyncAt ? new Date(googleConn.lastSyncAt).getTime() : 0;

		// Perform automatic sync if never synced or over 24 hours have passed
		if (now - lastSyncTime >= TWENTY_FOUR_HOURS_MS) {
			await triggerDailyAutoSync(mainWindow);
		}
	} catch (err) {
		console.warn("[DayPulse AutoSync] Scheduled sync check encountered an issue:", err);
	}
}

export function startDailySyncScheduler(mainWindow: BrowserWindow): void {
	if (syncTimer) return;

	console.log("[DayPulse AutoSync] Initializing daily automatic sync background service");

	// Initial check shortly after startup
	setTimeout(() => {
		performScheduledSyncCheck(mainWindow);
	}, 15000);

	// Periodic hourly check
	syncTimer = setInterval(() => {
		performScheduledSyncCheck(mainWindow);
	}, SYNC_INTERVAL_MS);
}

export function stopDailySyncScheduler(): void {
	if (syncTimer) {
		clearInterval(syncTimer);
		syncTimer = null;
	}
}
