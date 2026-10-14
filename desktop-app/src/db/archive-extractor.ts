import fs from "node:fs";
import type { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import type { BackupManifest } from "./archive-builder.js";
import {
	type BackupCollections,
	type BackupRecord,
	type MergeReport,
	mergeBackupIntoUser,
	summarizeMergeReport,
} from "./backup-merge.js";
import { getDatabasePath, getPrismaClient } from "./prisma-client.js";

export interface ArchivePreviewResult {
	valid: boolean;
	manifest: BackupManifest | null;
	user?: {
		id?: string;
		name?: string;
		email?: string;
		currency?: string;
	} | null;
	error?: string;
}

export interface ArchiveRestoreResult {
	success: boolean;
	manifest: BackupManifest | null;
	user?: {
		id?: string;
		name?: string;
		email?: string;
		currency?: string;
	} | null;
	restoredCounts: {
		tasks: number;
		routines: number;
		routineLogs: number;
		transactions: number;
		trackers: number;
		trackerLogs: number;
		categories: number;
		debtsLoans?: number;
		repayments?: number;
	};
	mergeReport?: MergeReport;
	summary?: string;
	safetyBackupPath?: string;
}

function resolveZipInput(input: Buffer | string): Buffer {
	if (Buffer.isBuffer(input)) {
		return input;
	}
	if (typeof input === "string") {
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

		let user = manifest.user || null;
		const userFile = zip.file("user.json");
		if (userFile && !user) {
			try {
				const userText = await userFile.async("string");
				user = JSON.parse(userText);
			} catch {
				// ignore
			}
		}

		return {
			valid: true,
			manifest,
			user,
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

export async function extractArchiveCollections(zip: JSZip): Promise<{
	manifest: BackupManifest | null;
	user: {
		id?: string;
		name?: string;
		email?: string;
		currency?: string;
	} | null;
	collections: BackupCollections;
}> {
	let manifest: BackupManifest | null = null;
	const manifestFile = zip.file("manifest.json");
	if (manifestFile) {
		try {
			manifest = JSON.parse(await manifestFile.async("string"));
		} catch {
			// ignore
		}
	}

	const readJsonFromZip = async <T>(filenames: string | string[]): Promise<T[]> => {
		const names = Array.isArray(filenames) ? filenames : [filenames];
		for (const name of names) {
			const file = zip.file(name);
			if (file) {
				try {
					const text = await file.async("string");
					const parsed = JSON.parse(text);
					if (Array.isArray(parsed) && parsed.length > 0) return parsed as T[];
				} catch {
					// continue
				}
			}
		}
		return [];
	};

	let user = manifest?.user || null;
	const userFile = zip.file("user.json");
	if (userFile && !user) {
		try {
			const userText = await userFile.async("string");
			user = JSON.parse(userText);
		} catch {
			// ignore
		}
	}

	const [
		tasks,
		routines,
		routineLogs,
		transactions,
		trackers,
		trackerLogs,
		categories,
		debtsLoans,
		repayments,
	] = await Promise.all([
		readJsonFromZip<BackupRecord>("tasks.json"),
		readJsonFromZip<BackupRecord>("routines.json"),
		readJsonFromZip<BackupRecord>(["routine-logs.json", "routine_logs.json"]),
		readJsonFromZip<BackupRecord>(["transactions.json", "finances.json"]),
		readJsonFromZip<BackupRecord>("trackers.json"),
		readJsonFromZip<BackupRecord>(["tracker-logs.json", "tracker_logs.json"]),
		readJsonFromZip<BackupRecord>("categories.json"),
		readJsonFromZip<BackupRecord>(["debts-loans.json", "debts_loans.json"]),
		readJsonFromZip<BackupRecord>([
			"repayments.json",
			"debt-repayments.json",
			"debt_repayments.json",
		]),
	]);

	return {
		manifest,
		user,
		collections: {
			tasks,
			routines,
			routineLogs,
			transactions,
			trackers,
			trackerLogs,
			categories,
			debtsLoans,
			repayments,
		},
	};
}

export async function restoreBackupArchive(
	archiveInput: Buffer | string,
	targetUserId: string,
	prisma?: PrismaClient,
): Promise<ArchiveRestoreResult> {
	const db = prisma || getPrismaClient();
	const buffer = resolveZipInput(archiveInput);

	let safetyBackupPath: string | undefined;
	try {
		const currentDbPath = getDatabasePath();
		if (fs.existsSync(currentDbPath)) {
			safetyBackupPath = `${currentDbPath}.pre_restore.bak`;
			fs.copyFileSync(currentDbPath, safetyBackupPath);
		}
	} catch (backupErr) {
		console.warn("[DayPulse Restore] Pre-restore safety backup notice:", backupErr);
	}

	const zip = await JSZip.loadAsync(buffer);
	const { manifest, user, collections } = await extractArchiveCollections(zip);

	const mergeReport = await mergeBackupIntoUser(db, targetUserId, collections);
	const summary = summarizeMergeReport(mergeReport);

	return {
		success: true,
		manifest,
		user,
		restoredCounts: {
			tasks: (mergeReport.tasks?.created || 0) + (mergeReport.tasks?.updated || 0),
			routines: (mergeReport.routines?.created || 0) + (mergeReport.routines?.updated || 0),
			routineLogs: (mergeReport.routineLogs?.created || 0) + (mergeReport.routineLogs?.updated || 0),
			transactions:
				(mergeReport.transactions?.created || 0) + (mergeReport.transactions?.updated || 0),
			trackers: (mergeReport.trackers?.created || 0) + (mergeReport.trackers?.updated || 0),
			trackerLogs:
				(mergeReport.trackerLogs?.created || 0) + (mergeReport.trackerLogs?.updated || 0),
			categories: (mergeReport.categories?.created || 0) + (mergeReport.categories?.updated || 0),
			debtsLoans: (mergeReport.debtsLoans?.created || 0) + (mergeReport.debtsLoans?.updated || 0),
			repayments: (mergeReport.repayments?.created || 0) + (mergeReport.repayments?.updated || 0),
		},
		mergeReport,
		summary,
		safetyBackupPath,
	};
}
