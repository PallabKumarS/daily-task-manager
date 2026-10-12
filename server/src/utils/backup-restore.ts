import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import JSZip from "jszip";
import { prisma } from "./prisma.js";

export interface RestoredUserData {
	id: string;
	name: string;
	email: string;
	currency: string;
	createdAt: Date;
}

export interface RestoreExecutionResult {
	user: RestoredUserData;
	summary: string;
	counts: {
		tasks: number;
		routines: number;
		routineLogs: number;
		transactions: number;
		trackers: number;
		trackerLogs: number;
	};
}

interface RawCollections {
	tasks: Array<Record<string, unknown>>;
	routines: Array<Record<string, unknown>>;
	routineLogs: Array<Record<string, unknown>>;
	transactions: Array<Record<string, unknown>>;
	trackers: Array<Record<string, unknown>>;
	trackerLogs: Array<Record<string, unknown>>;
}

export async function extractCollectionsFromArchive(archiveBase64: string): Promise<{
	user?: { name?: string; email?: string; currency?: string };
	collections: RawCollections;
}> {
	const cleanBase64 = archiveBase64.replace(/^data:.*?;base64,/, "").trim();
	const buffer = Buffer.from(cleanBase64, "base64");
	const zip = await JSZip.loadAsync(buffer);

	let user: { name?: string; email?: string; currency?: string } | undefined;
	const manifestFile = zip.file("manifest.json");
	if (manifestFile) {
		try {
			const manifestText = await manifestFile.async("string");
			const parsedManifest = JSON.parse(manifestText);
			if (parsedManifest.user) {
				user = parsedManifest.user;
			}
		} catch {}
	}

	const readCollection = async (fileName: string): Promise<Array<Record<string, unknown>>> => {
		const f = zip.file(fileName);
		if (!f) return [];
		try {
			const text = await f.async("string");
			const parsed = JSON.parse(text);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	};

	const [tasks, routines, routineLogs, transactions, trackers, trackerLogs] = await Promise.all([
		readCollection("tasks.json"),
		readCollection("routines.json"),
		readCollection("routineLogs.json"),
		readCollection("transactions.json"),
		readCollection("trackers.json"),
		readCollection("trackerLogs.json"),
	]);

	return {
		user,
		collections: {
			tasks,
			routines,
			routineLogs,
			transactions,
			trackers,
			trackerLogs,
		},
	};
}

export async function executeRestoreCollectionsIntoDB(
	userId: string,
	collections: RawCollections,
): Promise<{
	tasks: number;
	routines: number;
	routineLogs: number;
	transactions: number;
	trackers: number;
	trackerLogs: number;
}> {
	let taskCount = 0;
	let routineCount = 0;
	let logCount = 0;
	let txCount = 0;
	let trackerCount = 0;
	let trackerLogCount = 0;

	// 1. Routines
	for (const r of collections.routines) {
		const id = String(r.id || "");
		if (!id) continue;
		await prisma.routine.upsert({
			where: { id },
			update: {
				title: String(r.title || "Routine"),
				description: r.description ? String(r.description) : null,
				timeSlot: String(r.timeSlot || "ANYTIME"),
				targetTime: r.targetTime ? String(r.targetTime) : null,
				daysOfWeek: String(r.daysOfWeek || "1,2,3,4,5,6,7"),
				streakCount: Number(r.streakCount) || 0,
				lastCompletedDate: r.lastCompletedDate ? String(r.lastCompletedDate) : null,
				reminderMinutes: Number(r.reminderMinutes) || 0,
			},
			create: {
				id,
				userId,
				title: String(r.title || "Routine"),
				description: r.description ? String(r.description) : null,
				timeSlot: String(r.timeSlot || "ANYTIME"),
				targetTime: r.targetTime ? String(r.targetTime) : null,
				daysOfWeek: String(r.daysOfWeek || "1,2,3,4,5,6,7"),
				streakCount: Number(r.streakCount) || 0,
				lastCompletedDate: r.lastCompletedDate ? String(r.lastCompletedDate) : null,
				reminderMinutes: Number(r.reminderMinutes) || 0,
			},
		});
		routineCount++;
	}

	// 2. Routine Logs
	for (const l of collections.routineLogs) {
		const routineId = String(l.routineId || "");
		const date = String(l.date || "");
		if (!routineId || !date) continue;
		const routineExists = await prisma.routine.findUnique({ where: { id: routineId } });
		if (routineExists) {
			await prisma.routineLog.upsert({
				where: { routineId_date: { routineId, date } },
				update: {
					completed: Boolean(l.completed),
					completedAt: l.completedAt ? new Date(String(l.completedAt)) : new Date(),
				},
				create: {
					id: String(l.id || crypto.randomUUID()),
					routineId,
					userId,
					date,
					completed: Boolean(l.completed),
					completedAt: l.completedAt ? new Date(String(l.completedAt)) : new Date(),
				},
			});
			logCount++;
		}
	}

	// 3. Tasks
	for (const t of collections.tasks) {
		const id = String(t.id || "");
		if (!id) continue;
		await prisma.task.upsert({
			where: { id },
			update: {
				title: String(t.title || "Task"),
				description: t.description ? String(t.description) : null,
				type: String(t.type || "SINGLE"),
				category: String(t.category || "GENERAL"),
				priority: String(t.priority || "MEDIUM"),
				status: String(t.status || "PENDING"),
				startDate: t.startDate ? new Date(String(t.startDate)) : null,
				dueDate: t.dueDate ? new Date(String(t.dueDate)) : null,
				remindBeforeMinutes: Number(t.remindBeforeMinutes) || 0,
				reminderSent: Boolean(t.reminderSent),
				completedAt: t.completedAt ? new Date(String(t.completedAt)) : null,
			},
			create: {
				id,
				userId,
				title: String(t.title || "Task"),
				description: t.description ? String(t.description) : null,
				type: String(t.type || "SINGLE"),
				category: String(t.category || "GENERAL"),
				priority: String(t.priority || "MEDIUM"),
				status: String(t.status || "PENDING"),
				startDate: t.startDate ? new Date(String(t.startDate)) : null,
				dueDate: t.dueDate ? new Date(String(t.dueDate)) : null,
				remindBeforeMinutes: Number(t.remindBeforeMinutes) || 0,
				reminderSent: Boolean(t.reminderSent),
				completedAt: t.completedAt ? new Date(String(t.completedAt)) : null,
			},
		});
		taskCount++;
	}

	// 4. Transactions
	for (const tr of collections.transactions) {
		const id = String(tr.id || "");
		if (!id) continue;
		await prisma.transaction.upsert({
			where: { id },
			update: {
				type: String(tr.type || "EXPENSE"),
				amount: Number(tr.amount) || 0,
				category: String(tr.category || "GENERAL"),
				description: tr.description ? String(tr.description) : null,
				paymentMethod: String(tr.paymentMethod || "CASH"),
				date: tr.date ? new Date(String(tr.date)) : new Date(),
			},
			create: {
				id,
				userId,
				type: String(tr.type || "EXPENSE"),
				amount: Number(tr.amount) || 0,
				category: String(tr.category || "GENERAL"),
				description: tr.description ? String(tr.description) : null,
				paymentMethod: String(tr.paymentMethod || "CASH"),
				date: tr.date ? new Date(String(tr.date)) : new Date(),
			},
		});
		txCount++;
	}

	// 5. Trackers
	for (const dt of collections.trackers) {
		const id = String(dt.id || "");
		if (!id) continue;
		await prisma.dailyTracker.upsert({
			where: { id },
			update: {
				name: String(dt.name || "Tracker"),
				category: String(dt.category || "GENERAL"),
				unitName: String(dt.unitName || "count"),
				defaultTarget: Number(dt.defaultTarget) || 0,
				unitPrice:
					dt.unitPrice !== undefined && dt.unitPrice !== null ? Number(dt.unitPrice) : null,
				currency: String(dt.currency || "USD"),
				description: dt.description ? String(dt.description) : null,
				color: dt.color ? String(dt.color) : null,
				isArchived: Boolean(dt.isArchived),
			},
			create: {
				id,
				userId,
				name: String(dt.name || "Tracker"),
				category: String(dt.category || "GENERAL"),
				unitName: String(dt.unitName || "count"),
				defaultTarget: Number(dt.defaultTarget) || 0,
				unitPrice:
					dt.unitPrice !== undefined && dt.unitPrice !== null ? Number(dt.unitPrice) : null,
				currency: String(dt.currency || "USD"),
				description: dt.description ? String(dt.description) : null,
				color: dt.color ? String(dt.color) : null,
				isArchived: Boolean(dt.isArchived),
			},
		});
		trackerCount++;
	}

	// 6. Tracker Logs
	for (const dtl of collections.trackerLogs) {
		const trackerId = String(dtl.trackerId || "");
		const date = String(dtl.date || "");
		if (!trackerId || !date) continue;
		const trackerExists = await prisma.dailyTracker.findUnique({ where: { id: trackerId } });
		if (trackerExists) {
			await prisma.dailyTrackerLog.upsert({
				where: { trackerId_date: { trackerId, date } },
				update: {
					value: Number(dtl.value) || 0,
					status: String(dtl.status || "IN_PROGRESS"),
					unitPrice:
						dtl.unitPrice !== undefined && dtl.unitPrice !== null ? Number(dtl.unitPrice) : null,
					notes: dtl.notes ? String(dtl.notes) : null,
					isSettled: Boolean(dtl.isSettled),
					settledAt: dtl.settledAt ? new Date(String(dtl.settledAt)) : null,
					settlementTransactionId: dtl.settlementTransactionId
						? String(dtl.settlementTransactionId)
						: null,
				},
				create: {
					id: String(dtl.id || crypto.randomUUID()),
					trackerId,
					userId,
					date,
					value: Number(dtl.value) || 0,
					status: String(dtl.status || "IN_PROGRESS"),
					unitPrice:
						dtl.unitPrice !== undefined && dtl.unitPrice !== null ? Number(dtl.unitPrice) : null,
					notes: dtl.notes ? String(dtl.notes) : null,
					isSettled: Boolean(dtl.isSettled),
					settledAt: dtl.settledAt ? new Date(String(dtl.settledAt)) : null,
					settlementTransactionId: dtl.settlementTransactionId
						? String(dtl.settlementTransactionId)
						: null,
				},
			});
			trackerLogCount++;
		}
	}

	return {
		tasks: taskCount,
		routines: routineCount,
		routineLogs: logCount,
		transactions: txCount,
		trackers: trackerCount,
		trackerLogs: trackerLogCount,
	};
}

export async function processRestorePayloadIntoDB(payload: {
	archiveBase64?: string;
	backup?: Record<string, unknown>;
	password?: string;
}): Promise<RestoreExecutionResult> {
	let targetEmail = "";
	let targetName = "Restored User";
	let targetCurrency = "USD";
	let collections: RawCollections = {
		tasks: [],
		routines: [],
		routineLogs: [],
		transactions: [],
		trackers: [],
		trackerLogs: [],
	};

	if (payload.archiveBase64) {
		const extracted = await extractCollectionsFromArchive(payload.archiveBase64);
		collections = extracted.collections;
		targetEmail = extracted.user?.email || "";
		targetName = extracted.user?.name || "Restored User";
		targetCurrency = extracted.user?.currency || "USD";
	} else if (payload.backup && typeof payload.backup === "object") {
		const u = (payload.backup.user as Record<string, unknown>) || {};
		targetEmail = String(u.email || "");
		targetName = String(u.name || "Restored User");
		targetCurrency = String(u.currency || "USD");

		const d = (payload.backup.data as Record<string, unknown>) || payload.backup;
		collections = {
			tasks: (d.tasks as Array<Record<string, unknown>>) || [],
			routines: (d.routines as Array<Record<string, unknown>>) || [],
			routineLogs: (d.routineLogs as Array<Record<string, unknown>>) || [],
			transactions: (d.transactions as Array<Record<string, unknown>>) || [],
			trackers:
				(d.dailyTrackers as Array<Record<string, unknown>>) ||
				(d.trackers as Array<Record<string, unknown>>) ||
				[],
			trackerLogs:
				(d.dailyTrackerLogs as Array<Record<string, unknown>>) ||
				(d.trackerLogs as Array<Record<string, unknown>>) ||
				[],
		};
	} else {
		throw new Error("No backup archive or data payload provided");
	}

	if (!targetEmail) {
		targetEmail = "local@daypulse.app";
	}

	let targetUser = await prisma.user.findUnique({
		where: { email: targetEmail.toLowerCase() },
	});

	if (!targetUser) {
		const salt = await bcrypt.genSalt(10);
		const rawPassword = payload.password?.trim() || crypto.randomUUID();
		const passwordHash = await bcrypt.hash(rawPassword, salt);

		targetUser = await prisma.user.create({
			data: {
				email: targetEmail.toLowerCase(),
				name: targetName,
				passwordHash,
				currency: targetCurrency.toUpperCase(),
			},
		});
	}

	const counts = await executeRestoreCollectionsIntoDB(targetUser.id, collections);
	const summary = `Restored ${counts.tasks} tasks, ${counts.routines} routines, ${counts.transactions} transactions, ${counts.trackers} trackers`;

	return {
		user: {
			id: targetUser.id,
			name: targetUser.name,
			email: targetUser.email,
			currency: targetUser.currency,
			createdAt: targetUser.createdAt,
		},
		summary,
		counts,
	};
}
