import type { Prisma, PrismaClient } from "@prisma/client";

export type BackupRecord = Record<string, unknown>;

export interface BackupCollections {
	tasks: BackupRecord[];
	routines: BackupRecord[];
	routineLogs: BackupRecord[];
	transactions: BackupRecord[];
	trackers: BackupRecord[];
	trackerLogs: BackupRecord[];
	categories: BackupRecord[];
}

export interface MergeStats {
	created: number;
	updated: number;
	skipped: number;
}

export type MergeReport = Record<keyof BackupCollections, MergeStats>;

type Tx = Prisma.TransactionClient;

const text = (value: unknown, fallback: string): string =>
	typeof value === "string" && value.trim() ? value : fallback;

const optionalText = (value: unknown): string | null =>
	typeof value === "string" && value !== "" ? value : null;

const numeric = (value: unknown, fallback: number): number => {
	if (value === null || value === undefined || value === "") return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const optionalNumber = (value: unknown): number | null => {
	if (value === null || value === undefined || value === "") return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const flag = (value: unknown, fallback: boolean): boolean =>
	typeof value === "boolean" ? value : fallback;

const optionalDate = (value: unknown): Date | null => {
	if (!value) return null;
	const parsed = new Date(String(value));
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const recordId = (record: BackupRecord): string | null =>
	typeof record.id === "string" && record.id ? record.id : null;

const emptyStats = (): MergeStats => ({ created: 0, updated: 0, skipped: 0 });

export const emptyCollections = (): BackupCollections => ({
	tasks: [],
	routines: [],
	routineLogs: [],
	transactions: [],
	trackers: [],
	trackerLogs: [],
	categories: [],
});

interface ExistingRow {
	id: string;
	userId: string;
	updatedAt: Date;
}

type Decision = "create" | "update" | "skip";

/**
 * Newer-wins conflict resolution: a local record is only overwritten when the
 * backup copy was modified more recently, so restoring an old backup never
 * clobbers edits made on this device afterwards. Records owned by a different
 * local account are never touched.
 */
function decide(
	existing: ExistingRow | undefined,
	incomingUpdatedAt: Date | null,
	userId: string,
): Decision {
	if (!existing) return "create";
	if (existing.userId !== userId) return "skip";
	if (incomingUpdatedAt && incomingUpdatedAt <= existing.updatedAt) {
		return "skip";
	}
	return "update";
}

function indexById(rows: ExistingRow[]): Map<string, ExistingRow> {
	return new Map(rows.map((row) => [row.id, row]));
}

const idsOf = (records: BackupRecord[]): string[] =>
	records.map(recordId).filter((id): id is string => Boolean(id));

const ROW_SELECT = { id: true, userId: true, updatedAt: true } as const;

function taskData(t: BackupRecord) {
	return {
		title: text(t.title, "Task"),
		description: optionalText(t.description),
		type: text(t.type, "TASK"),
		category: text(t.category, "General"),
		priority: text(t.priority, "MEDIUM"),
		status: text(t.status, "PENDING"),
		startDate: optionalDate(t.startDate),
		dueDate: optionalDate(t.dueDate),
		remindBeforeMinutes: numeric(t.remindBeforeMinutes, 15),
		reminderSent: flag(t.reminderSent, false),
		completedAt: optionalDate(t.completedAt),
		isRecurring: flag(t.isRecurring, false),
		repeatFrequency: optionalText(t.repeatFrequency),
		repeatInterval: numeric(t.repeatInterval, 1),
		repeatDaysOfWeek: optionalText(t.repeatDaysOfWeek),
		repeatTime: optionalText(t.repeatTime),
		repeatDayOfMonth: optionalNumber(t.repeatDayOfMonth),
		repeatMonthOfYear: optionalNumber(t.repeatMonthOfYear),
		repeatEndType: optionalText(t.repeatEndType),
		repeatCount: optionalNumber(t.repeatCount),
		completedOccurrences: numeric(t.completedOccurrences, 0),
		repeatUntil: optionalDate(t.repeatUntil),
		lastTriggeredDate: optionalText(t.lastTriggeredDate),
		lastCompletedDate: optionalText(t.lastCompletedDate),
	};
}

function routineData(r: BackupRecord) {
	return {
		title: text(r.title, "Routine"),
		description: optionalText(r.description),
		timeSlot: text(r.timeSlot, "morning"),
		targetTime: optionalText(r.targetTime),
		daysOfWeek: text(r.daysOfWeek, "0,1,2,3,4,5,6"),
		streakCount: numeric(r.streakCount, 0),
		lastCompletedDate: optionalText(r.lastCompletedDate),
		reminderMinutes: numeric(r.reminderMinutes, 0),
	};
}

function transactionData(tx: BackupRecord) {
	return {
		type: text(tx.type, "EXPENSE"),
		amount: numeric(tx.amount, 0),
		category: text(tx.category, "General"),
		description: optionalText(tx.description),
		paymentMethod: text(tx.paymentMethod, "Cash"),
		date: optionalDate(tx.date) ?? new Date(),
	};
}

function trackerData(trk: BackupRecord) {
	return {
		name: text(trk.name, "Tracker"),
		category: text(trk.category, "Meals & Food"),
		unitName: text(trk.unitName, "meals"),
		defaultTarget: numeric(trk.defaultTarget, 2),
		unitPrice: optionalNumber(trk.unitPrice),
		currency: text(trk.currency, "USD"),
		description: optionalText(trk.description),
		color: optionalText(trk.color) ?? "emerald",
		isArchived: flag(trk.isArchived, false),
	};
}

function trackerLogData(tl: BackupRecord) {
	return {
		value: numeric(tl.value, 0),
		status: text(tl.status, "LOGGED"),
		unitPrice: optionalNumber(tl.unitPrice),
		notes: optionalText(tl.notes),
		isSettled: flag(tl.isSettled, false),
		settledAt: optionalDate(tl.settledAt),
		settlementTransactionId: optionalText(tl.settlementTransactionId),
	};
}

function timestamps(record: BackupRecord) {
	const createdAt = optionalDate(record.createdAt) ?? new Date();
	const updatedAt = optionalDate(record.updatedAt) ?? createdAt;
	return { createdAt, updatedAt };
}

async function mergeTasks(tx: Tx, userId: string, records: BackupRecord[]) {
	const stats = emptyStats();
	const existing = indexById(
		await tx.task.findMany({
			where: { id: { in: idsOf(records) } },
			select: ROW_SELECT,
		}),
	);
	for (const record of records) {
		const id = recordId(record);
		const stamps = timestamps(record);
		const decision = decide(
			id ? existing.get(id) : undefined,
			optionalDate(record.updatedAt),
			userId,
		);
		if (decision === "skip") {
			stats.skipped++;
		} else if (decision === "update" && id) {
			await tx.task.update({
				where: { id },
				data: { ...taskData(record), updatedAt: stamps.updatedAt },
			});
			stats.updated++;
		} else {
			await tx.task.create({
				data: {
					...(id ? { id } : {}),
					userId,
					...taskData(record),
					...stamps,
				},
			});
			stats.created++;
		}
	}
	return stats;
}

async function mergeRoutines(tx: Tx, userId: string, records: BackupRecord[]) {
	const stats = emptyStats();
	const existing = indexById(
		await tx.routine.findMany({
			where: { id: { in: idsOf(records) } },
			select: ROW_SELECT,
		}),
	);
	for (const record of records) {
		const id = recordId(record);
		const stamps = timestamps(record);
		const decision = decide(
			id ? existing.get(id) : undefined,
			optionalDate(record.updatedAt),
			userId,
		);
		if (decision === "skip") {
			stats.skipped++;
		} else if (decision === "update" && id) {
			await tx.routine.update({
				where: { id },
				data: { ...routineData(record), updatedAt: stamps.updatedAt },
			});
			stats.updated++;
		} else {
			await tx.routine.create({
				data: {
					...(id ? { id } : {}),
					userId,
					...routineData(record),
					...stamps,
				},
			});
			stats.created++;
		}
	}
	return stats;
}

async function mergeTransactions(
	tx: Tx,
	userId: string,
	records: BackupRecord[],
) {
	const stats = emptyStats();
	const existing = indexById(
		await tx.transaction.findMany({
			where: { id: { in: idsOf(records) } },
			select: ROW_SELECT,
		}),
	);
	for (const record of records) {
		const id = recordId(record);
		const stamps = timestamps(record);
		const decision = decide(
			id ? existing.get(id) : undefined,
			optionalDate(record.updatedAt),
			userId,
		);
		if (decision === "skip") {
			stats.skipped++;
		} else if (decision === "update" && id) {
			await tx.transaction.update({
				where: { id },
				data: { ...transactionData(record), updatedAt: stamps.updatedAt },
			});
			stats.updated++;
		} else {
			await tx.transaction.create({
				data: {
					...(id ? { id } : {}),
					userId,
					...transactionData(record),
					...stamps,
				},
			});
			stats.created++;
		}
	}
	return stats;
}

async function mergeTrackers(tx: Tx, userId: string, records: BackupRecord[]) {
	const stats = emptyStats();
	const existing = indexById(
		await tx.dailyTracker.findMany({
			where: { id: { in: idsOf(records) } },
			select: ROW_SELECT,
		}),
	);
	for (const record of records) {
		const id = recordId(record);
		const stamps = timestamps(record);
		const decision = decide(
			id ? existing.get(id) : undefined,
			optionalDate(record.updatedAt),
			userId,
		);
		if (decision === "skip") {
			stats.skipped++;
		} else if (decision === "update" && id) {
			await tx.dailyTracker.update({
				where: { id },
				data: { ...trackerData(record), updatedAt: stamps.updatedAt },
			});
			stats.updated++;
		} else {
			await tx.dailyTracker.create({
				data: {
					...(id ? { id } : {}),
					userId,
					...trackerData(record),
					...stamps,
				},
			});
			stats.created++;
		}
	}
	return stats;
}

async function ownedIds(
	tx: Tx,
	model: "routine" | "dailyTracker",
	userId: string,
	ids: string[],
): Promise<Set<string>> {
	const unique = [...new Set(ids)];
	const rows =
		model === "routine"
			? await tx.routine.findMany({
					where: { userId, id: { in: unique } },
					select: { id: true },
				})
			: await tx.dailyTracker.findMany({
					where: { userId, id: { in: unique } },
					select: { id: true },
				});
	return new Set(rows.map((row) => row.id));
}

async function mergeRoutineLogs(
	tx: Tx,
	userId: string,
	records: BackupRecord[],
) {
	const stats = emptyStats();
	const routineIds = records.map((r) => String(r.routineId || ""));
	const owned = await ownedIds(tx, "routine", userId, routineIds);

	for (const record of records) {
		const routineId = String(record.routineId || "");
		const date = String(record.date || "");
		if (!owned.has(routineId) || !date) {
			stats.skipped++;
			continue;
		}
		const completed = flag(record.completed, true);
		const completedAt = optionalDate(record.completedAt) ?? new Date();
		const local = await tx.routineLog.findUnique({
			where: { routineId_date: { routineId, date } },
		});
		if (!local) {
			await tx.routineLog.create({
				data: { routineId, userId, date, completed, completedAt },
			});
			stats.created++;
		} else if (
			completedAt > local.completedAt &&
			local.completed !== completed
		) {
			await tx.routineLog.update({
				where: { id: local.id },
				data: { completed, completedAt },
			});
			stats.updated++;
		} else {
			stats.skipped++;
		}
	}
	return stats;
}

async function mergeTrackerLogs(
	tx: Tx,
	userId: string,
	records: BackupRecord[],
) {
	const stats = emptyStats();
	const trackerIds = records.map((r) => String(r.trackerId || ""));
	const owned = await ownedIds(tx, "dailyTracker", userId, trackerIds);

	for (const record of records) {
		const trackerId = String(record.trackerId || "");
		const date = String(record.date || "");
		if (!owned.has(trackerId) || !date) {
			stats.skipped++;
			continue;
		}
		const stamps = timestamps(record);
		const local = await tx.dailyTrackerLog.findUnique({
			where: { trackerId_date: { trackerId, date } },
		});
		if (!local) {
			await tx.dailyTrackerLog.create({
				data: {
					trackerId,
					userId,
					date,
					...trackerLogData(record),
					...stamps,
				},
			});
			stats.created++;
		} else if (stamps.updatedAt > local.updatedAt) {
			await tx.dailyTrackerLog.update({
				where: { id: local.id },
				data: { ...trackerLogData(record), updatedAt: stamps.updatedAt },
			});
			stats.updated++;
		} else {
			stats.skipped++;
		}
	}
	return stats;
}

async function mergeCategories(
	tx: Tx,
	userId: string,
	records: BackupRecord[],
) {
	const stats = emptyStats();
	for (const record of records) {
		const name = text(record.name, "").trim();
		const group = text(record.group, "EXPENSE").trim().toUpperCase();
		if (!name) {
			stats.skipped++;
			continue;
		}
		const color = optionalText(record.color);
		const local = await tx.categoryOption.findUnique({
			where: { userId_group_name: { userId, group, name } },
		});
		if (!local) {
			await tx.categoryOption.create({
				data: {
					userId,
					group,
					name,
					color,
					createdAt: optionalDate(record.createdAt) ?? new Date(),
				},
			});
			stats.created++;
		} else if (color && color !== local.color) {
			await tx.categoryOption.update({
				where: { id: local.id },
				data: { color },
			});
			stats.updated++;
		} else {
			stats.skipped++;
		}
	}
	return stats;
}

/**
 * Merges a parsed backup into a local account inside a single database
 * transaction. Parents are merged before their logs so ownership checks on
 * routine and tracker logs see freshly restored rows.
 */
export async function mergeBackupIntoUser(
	prisma: PrismaClient,
	userId: string,
	collections: BackupCollections,
): Promise<MergeReport> {
	return prisma.$transaction(
		async (tx) => {
			const categories = await mergeCategories(
				tx,
				userId,
				collections.categories,
			);
			const tasks = await mergeTasks(tx, userId, collections.tasks);
			const routines = await mergeRoutines(tx, userId, collections.routines);
			const transactions = await mergeTransactions(
				tx,
				userId,
				collections.transactions,
			);
			const trackers = await mergeTrackers(tx, userId, collections.trackers);
			const routineLogs = await mergeRoutineLogs(
				tx,
				userId,
				collections.routineLogs,
			);
			const trackerLogs = await mergeTrackerLogs(
				tx,
				userId,
				collections.trackerLogs,
			);
			return {
				tasks,
				routines,
				routineLogs,
				transactions,
				trackers,
				trackerLogs,
				categories,
			};
		},
		{ timeout: 120_000, maxWait: 10_000 },
	);
}

export function summarizeMergeReport(report: MergeReport): string {
	const totals = Object.values(report).reduce(
		(acc, stats) => ({
			created: acc.created + stats.created,
			updated: acc.updated + stats.updated,
			skipped: acc.skipped + stats.skipped,
		}),
		emptyStats(),
	);
	const parts = [`${totals.created} added`, `${totals.updated} updated`];
	if (totals.skipped > 0) parts.push(`${totals.skipped} already up to date`);
	return parts.join(", ");
}
