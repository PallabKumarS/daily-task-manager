import fs from "node:fs";
import type { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import type { BackupManifest } from "./archive-builder.js";
import { getDatabasePath, getPrismaClient } from "./prisma-client.js";

export interface ArchivePreviewResult {
	valid: boolean;
	manifest: BackupManifest | null;
	error?: string;
}

export interface ArchiveRestoreResult {
	success: boolean;
	manifest: BackupManifest | null;
	restoredCounts: {
		tasks: number;
		routines: number;
		routineLogs: number;
		transactions: number;
		trackers: number;
		trackerLogs: number;
		categories: number;
	};
	safetyBackupPath?: string;
}

function resolveZipInput(input: Buffer | string): Buffer {
	if (Buffer.isBuffer(input)) {
		return input;
	}
	if (typeof input === "string") {
		// Clean base64 data url prefix if present
		const clean = input.replace(/^data:.*?;base64,/, "").trim();
		return Buffer.from(clean, "base64");
	}
	throw new Error("Invalid archive input type");
}

export async function previewBackupArchive(
	archiveInput: Buffer | string,
): Promise<ArchivePreviewResult> {
	try {
		const buffer = resolveZipInput(archiveInput);
		const zip = await JSZip.loadAsync(buffer);

		const manifestFile = zip.file("manifest.json");
		if (!manifestFile) {
			return {
				valid: false,
				manifest: null,
				error: "Archive is missing manifest.json metadata file",
			};
		}

		const manifestText = await manifestFile.async("string");
		const manifest = JSON.parse(manifestText) as BackupManifest;

		return {
			valid: true,
			manifest,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			valid: false,
			manifest: null,
			error: `Failed to inspect archive: ${message}`,
		};
	}
}

export async function restoreBackupArchive(
	archiveInput: Buffer | string,
	targetUserId: string,
	prisma?: PrismaClient,
): Promise<ArchiveRestoreResult> {
	const db = prisma || getPrismaClient();
	const buffer = resolveZipInput(archiveInput);

	// 1. Create safety backup of the database before restoring
	let safetyBackupPath: string | undefined;
	try {
		const currentDbPath = getDatabasePath();
		if (fs.existsSync(currentDbPath)) {
			safetyBackupPath = `${currentDbPath}.pre_restore.bak`;
			fs.copyFileSync(currentDbPath, safetyBackupPath);
		}
	} catch (backupErr) {
		console.warn(
			"[DayPulse Restore] Pre-restore safety backup notice:",
			backupErr,
		);
	}

	// 2. Load Zip archive
	const zip = await JSZip.loadAsync(buffer);

	// Extract manifest if present
	let manifest: BackupManifest | null = null;
	const manifestFile = zip.file("manifest.json");
	if (manifestFile) {
		try {
			manifest = JSON.parse(await manifestFile.async("string"));
		} catch {
			// ignore
		}
	}

	// Helper to extract JSON from zip or return empty array
	const readJsonFromZip = async <T>(filename: string): Promise<T[]> => {
		const file = zip.file(filename);
		if (!file) return [];
		try {
			const text = await file.async("string");
			const parsed = JSON.parse(text);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	};

	const [
		tasks,
		routines,
		routineLogs,
		transactions,
		trackers,
		trackerLogs,
		categories,
	] = await Promise.all([
		readJsonFromZip<Record<string, unknown>>("tasks.json"),
		readJsonFromZip<Record<string, unknown>>("routines.json"),
		readJsonFromZip<Record<string, unknown>>("routine-logs.json"),
		readJsonFromZip<Record<string, unknown>>("transactions.json"),
		readJsonFromZip<Record<string, unknown>>("trackers.json"),
		readJsonFromZip<Record<string, unknown>>("tracker-logs.json"),
		readJsonFromZip<Record<string, unknown>>("categories.json"),
	]);

	// 3. Upsert Categories
	let categoryCount = 0;
	for (const c of categories) {
		const id = String(c.id);
		await db.categoryOption
			.upsert({
				where: { id },
				create: {
					id,
					userId: targetUserId,
					name: String(c.name || "General"),
					group: String(c.group || "EXPENSE"),
					color: typeof c.color === "string" ? c.color : null,
				},
				update: {
					name: String(c.name || "General"),
					group: String(c.group || "EXPENSE"),
					color: typeof c.color === "string" ? c.color : null,
				},
			})
			.then(() => {
				categoryCount++;
			})
			.catch(() => null);
	}

	// 4. Upsert Tasks
	let taskCount = 0;
	for (const t of tasks) {
		const id = String(t.id);
		await db.task
			.upsert({
				where: { id },
				create: {
					id,
					userId: targetUserId,
					title: String(t.title || "Task"),
					description: typeof t.description === "string" ? t.description : null,
					type: typeof t.type === "string" ? t.type : "TASK",
					category: typeof t.category === "string" ? t.category : "General",
					priority: typeof t.priority === "string" ? t.priority : "MEDIUM",
					status: typeof t.status === "string" ? t.status : "PENDING",
					startDate: t.startDate ? new Date(String(t.startDate)) : null,
					dueDate: t.dueDate ? new Date(String(t.dueDate)) : null,
					remindBeforeMinutes: Number(t.remindBeforeMinutes) || 15,
					isRecurring: Boolean(t.isRecurring),
					repeatFrequency:
						typeof t.repeatFrequency === "string" ? t.repeatFrequency : null,
					repeatInterval: Number(t.repeatInterval) || 1,
					repeatDaysOfWeek:
						typeof t.repeatDaysOfWeek === "string" ? t.repeatDaysOfWeek : null,
					repeatTime: typeof t.repeatTime === "string" ? t.repeatTime : null,
				},
				update: {
					title: String(t.title || "Task"),
					description: typeof t.description === "string" ? t.description : null,
					type: typeof t.type === "string" ? t.type : "TASK",
					category: typeof t.category === "string" ? t.category : "General",
					priority: typeof t.priority === "string" ? t.priority : "MEDIUM",
					status: typeof t.status === "string" ? t.status : "PENDING",
					startDate: t.startDate ? new Date(String(t.startDate)) : null,
					dueDate: t.dueDate ? new Date(String(t.dueDate)) : null,
				},
			})
			.then(() => {
				taskCount++;
			})
			.catch(() => null);
	}

	// 5. Upsert Routines
	let routineCount = 0;
	for (const r of routines) {
		const id = String(r.id);
		await db.routine
			.upsert({
				where: { id },
				create: {
					id,
					userId: targetUserId,
					title: String(r.title || "Routine"),
					description: typeof r.description === "string" ? r.description : null,
					timeSlot: typeof r.timeSlot === "string" ? r.timeSlot : "morning",
					targetTime: typeof r.targetTime === "string" ? r.targetTime : null,
					daysOfWeek:
						typeof r.daysOfWeek === "string" ? r.daysOfWeek : "0,1,2,3,4,5,6",
					reminderMinutes: Number(r.reminderMinutes) || 0,
					streakCount: Number(r.streakCount) || 0,
					lastCompletedDate:
						typeof r.lastCompletedDate === "string"
							? r.lastCompletedDate
							: null,
				},
				update: {
					title: String(r.title || "Routine"),
					description: typeof r.description === "string" ? r.description : null,
					timeSlot: typeof r.timeSlot === "string" ? r.timeSlot : "morning",
					targetTime: typeof r.targetTime === "string" ? r.targetTime : null,
					daysOfWeek:
						typeof r.daysOfWeek === "string" ? r.daysOfWeek : "0,1,2,3,4,5,6",
				},
			})
			.then(() => {
				routineCount++;
			})
			.catch(() => null);
	}

	// 6. Upsert Routine Logs
	let routineLogCount = 0;
	for (const rl of routineLogs) {
		const routineId = String(rl.routineId);
		const date = String(rl.date);
		await db.routineLog
			.upsert({
				where: {
					routineId_date: { routineId, date },
				},
				create: {
					routineId,
					userId: targetUserId,
					date,
					completed: Boolean(rl.completed),
				},
				update: {
					completed: Boolean(rl.completed),
				},
			})
			.then(() => {
				routineLogCount++;
			})
			.catch(() => null);
	}

	// 7. Upsert Transactions
	let txCount = 0;
	for (const tx of transactions) {
		const id = String(tx.id);
		await db.transaction
			.upsert({
				where: { id },
				create: {
					id,
					userId: targetUserId,
					type: String(tx.type || "EXPENSE"),
					amount: Number(tx.amount) || 0,
					category: String(tx.category || "General"),
					description:
						typeof tx.description === "string" ? tx.description : null,
					paymentMethod:
						typeof tx.paymentMethod === "string" ? tx.paymentMethod : "Cash",
					date: tx.date ? new Date(String(tx.date)) : new Date(),
				},
				update: {
					type: String(tx.type || "EXPENSE"),
					amount: Number(tx.amount) || 0,
					category: String(tx.category || "General"),
					description:
						typeof tx.description === "string" ? tx.description : null,
				},
			})
			.then(() => {
				txCount++;
			})
			.catch(() => null);
	}

	// 8. Upsert Trackers
	let trackerCount = 0;
	for (const trk of trackers) {
		const id = String(trk.id);
		await db.dailyTracker
			.upsert({
				where: { id },
				create: {
					id,
					userId: targetUserId,
					name: String(trk.name || "Tracker"),
					category:
						typeof trk.category === "string" ? trk.category : "Meals & Food",
					unitName: typeof trk.unitName === "string" ? trk.unitName : "meals",
					defaultTarget: Number(trk.defaultTarget) || 2,
					unitPrice: trk.unitPrice ? Number(trk.unitPrice) : null,
					currency: typeof trk.currency === "string" ? trk.currency : "USD",
					description:
						typeof trk.description === "string" ? trk.description : null,
					color: typeof trk.color === "string" ? trk.color : "emerald",
				},
				update: {
					name: String(trk.name || "Tracker"),
					unitPrice: trk.unitPrice ? Number(trk.unitPrice) : null,
				},
			})
			.then(() => {
				trackerCount++;
			})
			.catch(() => null);
	}

	// 9. Upsert Tracker Logs
	let trackerLogCount = 0;
	for (const tl of trackerLogs) {
		const trackerId = String(tl.trackerId);
		const date = String(tl.date);
		await db.dailyTrackerLog
			.upsert({
				where: {
					trackerId_date: { trackerId, date },
				},
				create: {
					trackerId,
					userId: targetUserId,
					date,
					value: Number(tl.value) || 0,
					status: typeof tl.status === "string" ? tl.status : "LOGGED",
					unitPrice: tl.unitPrice ? Number(tl.unitPrice) : null,
					notes: typeof tl.notes === "string" ? tl.notes : null,
					isSettled: Boolean(tl.isSettled),
				},
				update: {
					value: tl.value !== undefined ? Number(tl.value) : undefined,
					status: typeof tl.status === "string" ? tl.status : undefined,
					unitPrice:
						tl.unitPrice !== undefined ? Number(tl.unitPrice) : undefined,
					notes: typeof tl.notes === "string" ? tl.notes : undefined,
					isSettled:
						tl.isSettled !== undefined ? Boolean(tl.isSettled) : undefined,
				},
			})
			.then(() => {
				trackerLogCount++;
			})
			.catch(() => null);
	}

	return {
		success: true,
		manifest,
		restoredCounts: {
			tasks: taskCount,
			routines: routineCount,
			routineLogs: routineLogCount,
			transactions: txCount,
			trackers: trackerCount,
			trackerLogs: trackerLogCount,
			categories: categoryCount,
		},
		safetyBackupPath,
	};
}
