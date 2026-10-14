import JSZip from "jszip";

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
};

function readCollection(key: string): Array<Record<string, unknown>> {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

export async function exportLocalArchive(): Promise<{
	fileName: string;
	base64: string;
	manifest: {
		exportedAt: string;
		counts: Record<string, number>;
	};
}> {
	const zip = new JSZip();

	let user = {
		id: "usr_local",
		name: "DayPulse User",
		email: "user@daypulse.app",
		currency: "USD",
	};

	try {
		const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
		if (rawUser) {
			user = JSON.parse(rawUser);
		}
	} catch {}

	const tasks = readCollection(STORAGE_KEYS.TASKS);
	const routines = readCollection(STORAGE_KEYS.ROUTINES);
	const routineLogs = readCollection(STORAGE_KEYS.ROUTINE_LOGS);
	const finances = readCollection(STORAGE_KEYS.FINANCES);
	const trackers = readCollection(STORAGE_KEYS.TRACKERS);
	const trackerLogs = readCollection(STORAGE_KEYS.TRACKER_LOGS);
	const categories = readCollection(STORAGE_KEYS.CATEGORIES);
	const debtsLoans = readCollection(STORAGE_KEYS.DEBTS_LOANS);
	const repayments = readCollection(STORAGE_KEYS.REPAYMENTS);

	const counts = {
		tasks: tasks.length,
		routines: routines.length,
		routineLogs: routineLogs.length,
		transactions: finances.length,
		trackers: trackers.length,
		trackerLogs: trackerLogs.length,
		categories: categories.length,
		debtsLoans: debtsLoans.length,
		repayments: repayments.length,
	};

	const manifest = {
		formatVersion: 2,
		appName: "DayPulse",
		exportedAt: new Date().toISOString(),
		user,
		counts,
		checksums: {},
	};

	const tasksJson = JSON.stringify(tasks, null, 2);
	const routinesJson = JSON.stringify(routines, null, 2);
	const routineLogsJson = JSON.stringify(routineLogs, null, 2);
	const financesJson = JSON.stringify(finances, null, 2);
	const trackersJson = JSON.stringify(trackers, null, 2);
	const trackerLogsJson = JSON.stringify(trackerLogs, null, 2);
	const categoriesJson = JSON.stringify(categories, null, 2);
	const debtsLoansJson = JSON.stringify(debtsLoans, null, 2);
	const repaymentsJson = JSON.stringify(repayments, null, 2);

	zip.file("manifest.json", JSON.stringify(manifest, null, 2));
	zip.file("user.json", JSON.stringify(user, null, 2));
	zip.file("tasks.json", tasksJson);
	zip.file("routines.json", routinesJson);
	zip.file("routine-logs.json", routineLogsJson);
	zip.file("routine_logs.json", routineLogsJson);
	zip.file("transactions.json", financesJson);
	zip.file("finances.json", financesJson);
	zip.file("trackers.json", trackersJson);
	zip.file("tracker-logs.json", trackerLogsJson);
	zip.file("tracker_logs.json", trackerLogsJson);
	zip.file("categories.json", categoriesJson);
	zip.file("debts-loans.json", debtsLoansJson);
	zip.file("debts_loans.json", debtsLoansJson);
	zip.file("repayments.json", repaymentsJson);
	zip.file("debt-repayments.json", repaymentsJson);

	const base64 = await zip.generateAsync({
		type: "base64",
		compression: "DEFLATE",
		compressionOptions: { level: 9 },
	});

	const dateStr = new Date().toISOString().split("T")[0];
	const fileName = `DayPulse_Backup_${dateStr}.zip`;

	return {
		fileName,
		base64,
		manifest: {
			exportedAt: manifest.exportedAt,
			counts,
		},
	};
}
