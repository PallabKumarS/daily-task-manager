import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import { getPrismaClient } from "./prisma-client.js";

export interface BackupManifest {
	formatVersion: number;
	appName: string;
	exportedAt: string;
	user: {
		id: string;
		name: string;
		email: string;
		currency: string;
	} | null;
	counts: {
		tasks: number;
		routines: number;
		routineLogs: number;
		transactions: number;
		trackers: number;
		trackerLogs: number;
		categories: number;
	};
	checksums: Record<string, string>;
}

export interface ArchiveExportResult {
	buffer: Buffer;
	fileName: string;
	manifest: BackupManifest;
	base64: string;
}

function calculateSha256(content: string): string {
	return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export async function createBackupArchive(
	userId: string,
	prisma?: PrismaClient,
): Promise<ArchiveExportResult> {
	const db = prisma || getPrismaClient();

	const [user, tasks, routines, routineLogs, transactions, trackers, trackerLogs, categories] =
		await Promise.all([
			db.user.findUnique({ where: { id: userId } }),
			db.task.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
			db.routine.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
			db.routineLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
			db.transaction.findMany({
				where: { userId },
				orderBy: { date: "asc" },
			}),
			db.dailyTracker.findMany({
				where: { userId },
				orderBy: { createdAt: "asc" },
			}),
			db.dailyTrackerLog.findMany({
				where: { userId },
				orderBy: { date: "asc" },
			}),
			db.categoryOption.findMany({
				where: { userId },
				orderBy: { name: "asc" },
			}),
		]);

	const files: Record<string, string> = {
		"user.json": JSON.stringify(
			user
				? {
						id: user.id,
						name: user.name,
						email: user.email,
						currency: user.currency,
						createdAt: user.createdAt,
					}
				: null,
			null,
			2,
		),
		"tasks.json": JSON.stringify(tasks, null, 2),
		"routines.json": JSON.stringify(routines, null, 2),
		"routine-logs.json": JSON.stringify(routineLogs, null, 2),
		"transactions.json": JSON.stringify(transactions, null, 2),
		"trackers.json": JSON.stringify(trackers, null, 2),
		"tracker-logs.json": JSON.stringify(trackerLogs, null, 2),
		"categories.json": JSON.stringify(categories, null, 2),
	};

	const checksums: Record<string, string> = {};
	for (const [filename, content] of Object.entries(files)) {
		checksums[filename] = calculateSha256(content);
	}

	const nowIso = new Date().toISOString();
	const manifest: BackupManifest = {
		formatVersion: 1,
		appName: "DayPulse",
		exportedAt: nowIso,
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
					currency: user.currency,
				}
			: null,
		counts: {
			tasks: tasks.length,
			routines: routines.length,
			routineLogs: routineLogs.length,
			transactions: transactions.length,
			trackers: trackers.length,
			trackerLogs: trackerLogs.length,
			categories: categories.length,
		},
		checksums,
	};

	const zip = new JSZip();
	zip.file("manifest.json", JSON.stringify(manifest, null, 2));

	for (const [filename, content] of Object.entries(files)) {
		zip.file(filename, content);
	}

	const zipBuffer = await zip.generateAsync({
		type: "nodebuffer",
		compression: "DEFLATE",
		compressionOptions: { level: 9 },
	});

	const datePart = nowIso.slice(0, 10);
	const timePart = nowIso.slice(11, 19).replace(/:/g, "-");
	const fileName = `DayPulse_Backup_${datePart}_${timePart}.zip`;

	return {
		buffer: zipBuffer,
		fileName,
		manifest,
		base64: zipBuffer.toString("base64"),
	};
}
