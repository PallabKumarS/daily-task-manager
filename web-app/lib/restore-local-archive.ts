import JSZip from "jszip";
import { base64ToBlob } from "./backup-archive";

export interface LocalRestoreResult {
	success: boolean;
	message: string;
	user: {
		id: string;
		name: string;
		email: string;
		currency: string;
	} | null;
	token: string | null;
	counts: {
		tasks: number;
		routines: number;
		transactions: number;
		trackers: number;
		categories: number;
	};
}

const STORAGE_KEYS = {
	TASKS: "daypulse_local_tasks",
	ROUTINES: "daypulse_local_routines",
	ROUTINE_LOGS: "daypulse_local_routine_logs",
	FINANCES: "daypulse_local_finances",
	CATEGORIES: "daypulse_local_categories",
	TRACKERS: "daypulse_local_trackers",
	TRACKER_LOGS: "daypulse_local_tracker_logs",
	DEBTS_LOANS: "daypulse_local_debts_loans",
	REPAYMENTS: "daypulse_local_debt_repayments",
	USER: "daypulse_user_account",
	CREDENTIALS: "daypulse_user_credentials",
};

function mergeList<T extends Record<string, unknown>>(existing: T[], incoming: T[]): T[] {
	const map = new Map<string, T>();
	for (const item of existing) {
		const key = String(item.id || Math.random().toString());
		map.set(key, item);
	}
	for (const item of incoming) {
		const key = String(item.id || Math.random().toString());
		const prev = map.get(key);
		if (!prev) {
			map.set(key, item);
		} else {
			const incomingUpdated = item.updatedAt ? new Date(String(item.updatedAt)).getTime() : 0;
			const prevUpdated = prev.updatedAt ? new Date(String(prev.updatedAt)).getTime() : 0;
			map.set(key, incomingUpdated >= prevUpdated ? { ...prev, ...item } : prev);
		}
	}
	return Array.from(map.values());
}

function mergeTrackerLogs(
	existing: Array<Record<string, unknown>>,
	incoming: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	const map = new Map<string, Record<string, unknown>>();
	for (const item of existing) {
		const key =
			item.trackerId && item.date
				? `${item.trackerId}_${item.date}`
				: String(item.id || Math.random().toString());
		map.set(key, item);
	}
	for (const item of incoming) {
		const key =
			item.trackerId && item.date
				? `${item.trackerId}_${item.date}`
				: String(item.id || Math.random().toString());
		const prev = map.get(key);
		if (!prev) {
			map.set(key, item);
		} else {
			const incomingUpdated = item.updatedAt ? new Date(String(item.updatedAt)).getTime() : 0;
			const prevUpdated = prev.updatedAt ? new Date(String(prev.updatedAt)).getTime() : 0;
			map.set(key, incomingUpdated >= prevUpdated ? { ...prev, ...item } : prev);
		}
	}
	return Array.from(map.values());
}

function mergeRoutineLogs(
	existing: Array<Record<string, unknown>>,
	incoming: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	const map = new Map<string, Record<string, unknown>>();
	for (const item of existing) {
		const key =
			item.routineId && item.date
				? `${item.routineId}_${item.date}`
				: String(item.id || Math.random().toString());
		map.set(key, item);
	}
	for (const item of incoming) {
		const key =
			item.routineId && item.date
				? `${item.routineId}_${item.date}`
				: String(item.id || Math.random().toString());
		const prev = map.get(key);
		if (!prev) {
			map.set(key, item);
		} else {
			const incomingCompletedAt = item.completedAt
				? new Date(String(item.completedAt)).getTime()
				: 0;
			const prevCompletedAt = prev.completedAt ? new Date(String(prev.completedAt)).getTime() : 0;
			map.set(key, incomingCompletedAt >= prevCompletedAt ? { ...prev, ...item } : prev);
		}
	}
	return Array.from(map.values());
}

function mergeCategories(
	existing: Array<Record<string, unknown>>,
	incoming: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	const map = new Map<string, Record<string, unknown>>();
	for (const item of existing) {
		const key = `${String(item.group || "EXPENSE").toUpperCase()}_${String(item.name || "")
			.trim()
			.toLowerCase()}`;
		map.set(key, item);
	}
	for (const item of incoming) {
		const key = `${String(item.group || "EXPENSE").toUpperCase()}_${String(item.name || "")
			.trim()
			.toLowerCase()}`;
		map.set(key, item);
	}
	return Array.from(map.values());
}

export async function restoreLocalArchive(
	archiveBase64?: string,
	legacyBackup?: Record<string, unknown>,
	customPassword?: string,
): Promise<LocalRestoreResult> {
	let targetUser = {
		id: `usr_${Date.now()}`,
		name: "DayPulse User",
		email: "user@daypulse.app",
		currency: "USD",
	};

	let tasks: Array<Record<string, unknown>> = [];
	let routines: Array<Record<string, unknown>> = [];
	let routineLogs: Array<Record<string, unknown>> = [];
	let finances: Array<Record<string, unknown>> = [];
	let trackers: Array<Record<string, unknown>> = [];
	let trackerLogs: Array<Record<string, unknown>> = [];
	let categories: Array<Record<string, unknown>> = [];
	let debtsLoans: Array<Record<string, unknown>> = [];
	let repayments: Array<Record<string, unknown>> = [];

	if (archiveBase64) {
		try {
			const blob = base64ToBlob(archiveBase64);
			const zip = await JSZip.loadAsync(blob);

			const manifestFile = zip.file("manifest.json");
			if (manifestFile) {
				try {
					const manifestText = await manifestFile.async("string");
					const manifest = JSON.parse(manifestText);
					if (manifest.user) {
						targetUser = {
							id: manifest.user.id || targetUser.id,
							name: manifest.user.name || targetUser.name,
							email: manifest.user.email || targetUser.email,
							currency: manifest.user.currency || targetUser.currency,
						};
					}
				} catch {}
			}

			const userFile = zip.file("user.json");
			if (userFile) {
				try {
					const userText = await userFile.async("string");
					const u = JSON.parse(userText);
					targetUser = {
						id: u.id || targetUser.id,
						name: u.name || targetUser.name,
						email: u.email || targetUser.email,
						currency: u.currency || targetUser.currency,
					};
				} catch {}
			}

			const readCollection = async (filenames: string | string[]) => {
				const names = Array.isArray(filenames) ? filenames : [filenames];
				for (const name of names) {
					const file = zip.file(name);
					if (file) {
						try {
							const text = await file.async("string");
							const parsed = JSON.parse(text);
							if (Array.isArray(parsed) && parsed.length > 0) return parsed;
						} catch {}
					}
				}
				return [];
			};

			tasks = await readCollection("tasks.json");
			routines = await readCollection("routines.json");
			routineLogs = await readCollection(["routine-logs.json", "routine_logs.json"]);
			finances = await readCollection(["transactions.json", "finances.json"]);
			trackers = await readCollection("trackers.json");
			trackerLogs = await readCollection(["tracker-logs.json", "tracker_logs.json"]);
			categories = await readCollection("categories.json");
			debtsLoans = await readCollection(["debts-loans.json", "debts_loans.json"]);
			repayments = await readCollection([
				"repayments.json",
				"debt-repayments.json",
				"debt_repayments.json",
			]);
		} catch (err) {
			console.warn("[DayPulse Restore] Zip extraction fallback notice:", err);
		}
	}

	// Fallback to top-level arrays if provided in backup payload
	if (legacyBackup && typeof legacyBackup === "object") {
		const u = (legacyBackup.user as Record<string, unknown>) || {};
		if (u.id || u.email) {
			targetUser = {
				id: String(u.id || targetUser.id),
				name: String(u.name || targetUser.name),
				email: String(u.email || targetUser.email),
				currency: String(u.currency || targetUser.currency),
			};
		}

		if (tasks.length === 0 && Array.isArray(legacyBackup.tasks)) {
			tasks = legacyBackup.tasks as Array<Record<string, unknown>>;
		}
		if (routines.length === 0 && Array.isArray(legacyBackup.routines)) {
			routines = legacyBackup.routines as Array<Record<string, unknown>>;
		}
		if (routineLogs.length === 0) {
			const cand = legacyBackup.routineLogs || legacyBackup.routine_logs;
			if (Array.isArray(cand)) routineLogs = cand as Array<Record<string, unknown>>;
		}
		if (finances.length === 0) {
			const cand = legacyBackup.finances || legacyBackup.transactions;
			if (Array.isArray(cand)) finances = cand as Array<Record<string, unknown>>;
		}
		if (trackers.length === 0 && Array.isArray(legacyBackup.trackers)) {
			trackers = legacyBackup.trackers as Array<Record<string, unknown>>;
		}
		if (trackerLogs.length === 0) {
			const cand = legacyBackup.trackerLogs || legacyBackup.tracker_logs;
			if (Array.isArray(cand)) trackerLogs = cand as Array<Record<string, unknown>>;
		}
		if (categories.length === 0 && Array.isArray(legacyBackup.categories)) {
			categories = legacyBackup.categories as Array<Record<string, unknown>>;
		}
		if (debtsLoans.length === 0) {
			const cand = legacyBackup.debtsLoans || legacyBackup.debts_loans;
			if (Array.isArray(cand)) debtsLoans = cand as Array<Record<string, unknown>>;
		}
		if (repayments.length === 0) {
			const cand =
				legacyBackup.repayments || legacyBackup.debtRepayments || legacyBackup.debt_repayments;
			if (Array.isArray(cand)) repayments = cand as Array<Record<string, unknown>>;
		}
	}

	const hasAnyData =
		tasks.length > 0 ||
		routines.length > 0 ||
		routineLogs.length > 0 ||
		finances.length > 0 ||
		trackers.length > 0 ||
		trackerLogs.length > 0 ||
		categories.length > 0 ||
		debtsLoans.length > 0 ||
		repayments.length > 0;

	if (!hasAnyData && !archiveBase64) {
		return {
			success: false,
			message: "No valid backup data or archive provided",
			user: null,
			token: null,
			counts: { tasks: 0, routines: 0, transactions: 0, trackers: 0, categories: 0 },
		};
	}

	const getExisting = (key: string): Array<Record<string, unknown>> => {
		try {
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	};

	localStorage.setItem(
		STORAGE_KEYS.TASKS,
		JSON.stringify(mergeList(getExisting(STORAGE_KEYS.TASKS), tasks)),
	);
	localStorage.setItem(
		STORAGE_KEYS.ROUTINES,
		JSON.stringify(mergeList(getExisting(STORAGE_KEYS.ROUTINES), routines)),
	);
	localStorage.setItem(
		STORAGE_KEYS.ROUTINE_LOGS,
		JSON.stringify(mergeRoutineLogs(getExisting(STORAGE_KEYS.ROUTINE_LOGS), routineLogs)),
	);
	localStorage.setItem(
		STORAGE_KEYS.FINANCES,
		JSON.stringify(mergeList(getExisting(STORAGE_KEYS.FINANCES), finances)),
	);
	localStorage.setItem(
		STORAGE_KEYS.TRACKERS,
		JSON.stringify(mergeList(getExisting(STORAGE_KEYS.TRACKERS), trackers)),
	);
	localStorage.setItem(
		STORAGE_KEYS.TRACKER_LOGS,
		JSON.stringify(mergeTrackerLogs(getExisting(STORAGE_KEYS.TRACKER_LOGS), trackerLogs)),
	);
	if (categories.length > 0) {
		localStorage.setItem(
			STORAGE_KEYS.CATEGORIES,
			JSON.stringify(mergeCategories(getExisting(STORAGE_KEYS.CATEGORIES), categories)),
		);
	}
	if (debtsLoans.length > 0) {
		localStorage.setItem(
			STORAGE_KEYS.DEBTS_LOANS,
			JSON.stringify(mergeList(getExisting(STORAGE_KEYS.DEBTS_LOANS), debtsLoans)),
		);
	}
	if (repayments.length > 0) {
		localStorage.setItem(
			STORAGE_KEYS.REPAYMENTS,
			JSON.stringify(mergeList(getExisting(STORAGE_KEYS.REPAYMENTS), repayments)),
		);
	}

	const finalUser = {
		...targetUser,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(finalUser));
	if (customPassword) {
		localStorage.setItem(
			STORAGE_KEYS.CREDENTIALS,
			JSON.stringify({ email: finalUser.email, password: customPassword }),
		);
	}

	const token = `daypulse_token_${finalUser.id}`;
	return {
		success: true,
		message: `Restored ${tasks.length} tasks, ${routines.length} routines, ${finances.length} transactions, ${trackerLogs.length} tracker logs, and ${trackers.length} trackers`,
		user: finalUser,
		token,
		counts: {
			tasks: tasks.length,
			routines: routines.length,
			transactions: finances.length,
			trackers: trackers.length,
			categories: categories.length,
		},
	};
}
