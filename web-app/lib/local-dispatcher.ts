import type { ApiResponse } from "./api-client";
import { exportLocalArchive } from "./export-local-archive";
import { restoreLocalArchive } from "./restore-local-archive";

export interface LocalStoreState {
	tasks: Array<Record<string, unknown>>;
	routines: Array<Record<string, unknown>>;
	routineLogs: Array<Record<string, unknown>>;
	finances: Array<Record<string, unknown>>;
	categories: Array<Record<string, unknown>>;
	trackers: Array<Record<string, unknown>>;
	trackerLogs: Array<Record<string, unknown>>;
	debtsLoans: Array<Record<string, unknown>>;
	repayments: Array<Record<string, unknown>>;
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

const DEFAULT_CATEGORIES = [
	{ id: "cat-1", name: "Food & Dining", group: "EXPENSE", color: "#f87171" },
	{ id: "cat-2", name: "Transportation", group: "EXPENSE", color: "#fb923c" },
	{ id: "cat-3", name: "Entertainment", group: "EXPENSE", color: "#c084fc" },
	{ id: "cat-4", name: "Utilities", group: "EXPENSE", color: "#60a5fa" },
	{ id: "cat-5", name: "Shopping", group: "EXPENSE", color: "#f472b6" },
	{ id: "cat-6", name: "Salary", group: "INCOME", color: "#34d399" },
	{ id: "cat-7", name: "Freelance", group: "INCOME", color: "#2dd4bf" },
	{ id: "cat-8", name: "Investment", group: "INCOME", color: "#38bdf8" },
	{ id: "cat-9", name: "Cash", group: "PAYMENT_METHOD", color: "#a3e635" },
	{ id: "cat-10", name: "Bank Card", group: "PAYMENT_METHOD", color: "#818cf8" },
	{ id: "cat-11", name: "Mobile Banking", group: "PAYMENT_METHOD", color: "#fbbf24" },
	{ id: "cat-12", name: "General", group: "TASK_CATEGORY", color: "#94a3b8" },
	{ id: "cat-13", name: "Work", group: "TASK_CATEGORY", color: "#60a5fa" },
	{ id: "cat-14", name: "Personal", group: "TASK_CATEGORY", color: "#f472b6" },
];

function getList<T = Record<string, unknown>>(key: string): T[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveList<T = Record<string, unknown>>(key: string, items: T[]): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(key, JSON.stringify(items));
	} catch {}
}

function generateId(prefix = "loc"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function getLocalUser(): {
	id: string;
	name: string;
	email: string;
	currency: string;
	createdAt: string;
	updatedAt: string;
} | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.USER);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function getActiveUserId(): string {
	const user = getLocalUser();
	return user?.id || "usr_local";
}

export async function handleLocalClientDispatch<T = unknown>(
	endpoint: string,
	options: RequestInit = {},
): Promise<ApiResponse<T>> {
	const rawEndpoint = endpoint.replace(/^\/api\/v1/, "");
	const [pathname, queryString] = rawEndpoint.split("?");
	const method = (options.method || "GET").toUpperCase();

	let body: Record<string, unknown> = {};
	if (options.body) {
		try {
			body =
				typeof options.body === "string"
					? JSON.parse(options.body)
					: (options.body as unknown as Record<string, unknown>);
		} catch {
			body = {};
		}
	}

	const query: Record<string, string> = {};
	if (queryString) {
		for (const part of queryString.split("&")) {
			const [k, v] = part.split("=");
			if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || "");
		}
	}

	// 1. Auth routes
	if (pathname === "/auth/me") {
		const user = getLocalUser();
		if (!user) {
			return {
				statusCode: 401,
				success: false,
				message: "No active session on this device",
				data: null as unknown as T,
			};
		}
		if (method === "PATCH") {
			if (body.name) user.name = String(body.name).trim();
			if (body.currency) user.currency = String(body.currency).trim();
			user.updatedAt = new Date().toISOString();
			localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
			return { statusCode: 200, success: true, data: user as T };
		}
		return { statusCode: 200, success: true, data: user as T };
	}

	if (pathname === "/auth/register" && method === "POST") {
		const name = String(body.name || "").trim() || "DayPulse User";
		const email = String(body.email || "")
			.trim()
			.toLowerCase();
		const password = String(body.password || "");
		const currency = String(body.currency || "USD");

		const user = {
			id: generateId("usr"),
			name,
			email,
			currency,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
		localStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify({ email, password }));
		const token = `daypulse_token_${user.id}`;
		return {
			statusCode: 201,
			success: true,
			message: "Account created successfully",
			data: { user, token } as T,
		};
	}

	if (pathname === "/auth/login" && method === "POST") {
		const email = String(body.email || "")
			.trim()
			.toLowerCase();
		const password = String(body.password || "");
		const user = getLocalUser();

		if (!user) {
			return {
				statusCode: 404,
				success: false,
				message: "No account found on this device. Please create an account or restore a backup.",
				data: null as unknown as T,
			};
		}

		try {
			const credsRaw = localStorage.getItem(STORAGE_KEYS.CREDENTIALS);
			if (credsRaw) {
				const creds = JSON.parse(credsRaw);
				if (creds.email && creds.email !== email) {
					return {
						statusCode: 400,
						success: false,
						message: "Invalid email or password",
						data: null as unknown as T,
					};
				}
				if (creds.password && creds.password !== password) {
					return {
						statusCode: 400,
						success: false,
						message: "Invalid email or password",
						data: null as unknown as T,
					};
				}
			}
		} catch {}

		const token = `daypulse_token_${user.id}`;
		return {
			statusCode: 200,
			success: true,
			message: "Signed in successfully",
			data: { user, token } as T,
		};
	}

	if (pathname === "/auth/logout") {
		return {
			statusCode: 200,
			success: true,
			message: "Logged out successfully",
			data: null as unknown as T,
		};
	}

	if (pathname === "/auth/restore-backup" && method === "POST") {
		const archiveBase64 = String(body.archiveBase64 || body.archive || body.data || "");
		const backupPayload = (body.backup || body.data) as Record<string, unknown> | undefined;
		const customPassword = typeof body.password === "string" ? body.password : undefined;

		const restoreRes = await restoreLocalArchive(archiveBase64, backupPayload, customPassword);
		if (!restoreRes.success || !restoreRes.user) {
			return {
				statusCode: 400,
				success: false,
				message: restoreRes.message || "Failed to restore backup archive",
				data: null as unknown as T,
			};
		}

		return {
			statusCode: 200,
			success: true,
			message: restoreRes.message,
			data: {
				user: restoreRes.user,
				token: restoreRes.token,
				summary: restoreRes.message,
			} as T,
		};
	}

	// 2. Task routes
	if (pathname === "/tasks") {
		if (method === "GET") {
			const tasks = getList(STORAGE_KEYS.TASKS);
			return { statusCode: 200, success: true, data: tasks as T };
		}
		if (method === "POST") {
			const tasks = getList(STORAGE_KEYS.TASKS);
			const newTask = {
				id: generateId("task"),
				userId: getActiveUserId(),
				title: body.title || "Untitled Task",
				description: body.description || null,
				type: body.type || "TASK",
				category: body.category || "General",
				priority: body.priority || "MEDIUM",
				status: body.status || "PENDING",
				startDate: body.startDate || null,
				dueDate: body.dueDate || null,
				remindBeforeMinutes: Number(body.remindBeforeMinutes) || 15,
				reminderSent: false,
				completedAt: null,
				isRecurring: Boolean(body.isRecurring),
				repeatFrequency: body.repeatFrequency || null,
				repeatInterval: Number(body.repeatInterval) || 1,
				repeatDaysOfWeek: body.repeatDaysOfWeek || null,
				repeatTime: body.repeatTime || null,
				repeatEndType: body.repeatEndType || "NEVER",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			tasks.unshift(newTask);
			saveList(STORAGE_KEYS.TASKS, tasks);
			return { statusCode: 201, success: true, data: newTask as T };
		}
	}

	const taskMatch = pathname.match(/^\/tasks\/([^/]+)(?:\/(toggle))?$/);
	if (taskMatch) {
		const taskId = taskMatch[1];
		const isToggle = taskMatch[2] === "toggle";
		const tasks = getList(STORAGE_KEYS.TASKS);
		const idx = tasks.findIndex((t) => t.id === taskId);

		if (idx === -1) {
			return { statusCode: 404, success: false, message: "Task not found", data: null as T };
		}

		if (isToggle && method === "PATCH") {
			const current = tasks[idx];
			const nextStatus = current.status === "COMPLETED" ? "PENDING" : "COMPLETED";
			const updated = {
				...current,
				status: nextStatus,
				completedAt: nextStatus === "COMPLETED" ? new Date().toISOString() : null,
				updatedAt: new Date().toISOString(),
			};
			tasks[idx] = updated;
			saveList(STORAGE_KEYS.TASKS, tasks);
			return { statusCode: 200, success: true, data: updated as T };
		}

		if (method === "PATCH") {
			tasks[idx] = { ...tasks[idx], ...body, updatedAt: new Date().toISOString() };
			saveList(STORAGE_KEYS.TASKS, tasks);
			return { statusCode: 200, success: true, data: tasks[idx] as T };
		}

		if (method === "DELETE") {
			const deleted = tasks.splice(idx, 1)[0];
			saveList(STORAGE_KEYS.TASKS, tasks);
			return { statusCode: 200, success: true, data: deleted as T };
		}
	}

	// 3. Routine routes
	if (pathname === "/routines") {
		if (method === "GET") {
			const routines = getList(STORAGE_KEYS.ROUTINES);
			const logs = getList(STORAGE_KEYS.ROUTINE_LOGS);
			const withLogs = routines.map((r) => ({
				...r,
				logs: logs.filter((l) => l.routineId === r.id),
			}));
			return { statusCode: 200, success: true, data: withLogs as T };
		}
		if (method === "POST") {
			const routines = getList(STORAGE_KEYS.ROUTINES);
			const newRoutine = {
				id: generateId("rtn"),
				userId: getActiveUserId(),
				title: body.title || "Untitled Routine",
				description: body.description || null,
				timeSlot: body.timeSlot || "morning",
				targetTime: body.targetTime || null,
				daysOfWeek: body.daysOfWeek || "0,1,2,3,4,5,6",
				streakCount: 0,
				lastCompletedDate: null,
				reminderMinutes: Number(body.reminderMinutes) || 0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				logs: [],
			};
			routines.unshift(newRoutine);
			saveList(STORAGE_KEYS.ROUTINES, routines);
			return { statusCode: 201, success: true, data: newRoutine as T };
		}
	}

	const routineMatch = pathname.match(/^\/routines\/([^/]+)(?:\/(toggle))?$/);
	if (routineMatch) {
		const routineId = routineMatch[1];
		const isToggle = routineMatch[2] === "toggle";
		const routines = getList(STORAGE_KEYS.ROUTINES);
		const idx = routines.findIndex((r) => r.id === routineId);

		if (idx === -1) {
			return { statusCode: 404, success: false, message: "Routine not found", data: null as T };
		}

		if (isToggle && method === "PATCH") {
			const date = String(body.date || new Date().toISOString().split("T")[0]);
			const logs = getList(STORAGE_KEYS.ROUTINE_LOGS);
			const logIdx = logs.findIndex((l) => l.routineId === routineId && l.date === date);

			let completed = true;
			if (logIdx >= 0) {
				logs.splice(logIdx, 1);
				completed = false;
			} else {
				logs.push({
					id: generateId("log"),
					routineId,
					userId: getActiveUserId(),
					date,
					completed: true,
					completedAt: new Date().toISOString(),
				});
			}
			saveList(STORAGE_KEYS.ROUTINE_LOGS, logs);

			const currentRoutine = routines[idx];
			const streak = completed
				? Number(currentRoutine.streakCount || 0) + 1
				: Math.max(0, Number(currentRoutine.streakCount || 0) - 1);
			routines[idx] = {
				...currentRoutine,
				streakCount: streak,
				lastCompletedDate: completed ? date : currentRoutine.lastCompletedDate,
				updatedAt: new Date().toISOString(),
			};
			saveList(STORAGE_KEYS.ROUTINES, routines);
			return { statusCode: 200, success: true, data: { routine: routines[idx], completed } as T };
		}

		if (method === "PATCH") {
			routines[idx] = { ...routines[idx], ...body, updatedAt: new Date().toISOString() };
			saveList(STORAGE_KEYS.ROUTINES, routines);
			return { statusCode: 200, success: true, data: routines[idx] as T };
		}

		if (method === "DELETE") {
			const deleted = routines.splice(idx, 1)[0];
			saveList(STORAGE_KEYS.ROUTINES, routines);
			return { statusCode: 200, success: true, data: deleted as T };
		}
	}

	// 4. Finance routes
	if (pathname === "/finances") {
		if (method === "GET") {
			const finances = getList(STORAGE_KEYS.FINANCES);
			return {
				statusCode: 200,
				success: true,
				data: finances as T,
				meta: { page: 1, limit: 100, totalData: finances.length, totalPage: 1 },
			};
		}
		if (method === "POST") {
			const finances = getList(STORAGE_KEYS.FINANCES);
			const newTx = {
				id: generateId("tx"),
				userId: getActiveUserId(),
				type: body.type || "EXPENSE",
				amount: Number(body.amount) || 0,
				category: body.category || "General",
				description: body.description || "",
				paymentMethod: body.paymentMethod || "Cash",
				date: body.date || new Date().toISOString(),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			finances.unshift(newTx);
			saveList(STORAGE_KEYS.FINANCES, finances);
			return { statusCode: 201, success: true, data: newTx as T };
		}
	}

	if (pathname === "/finances/summary" && method === "GET") {
		const finances = getList(STORAGE_KEYS.FINANCES);
		let totalIncome = 0;
		let totalExpense = 0;
		for (const tx of finances) {
			const amt = Number(tx.amount) || 0;
			if (tx.type === "INCOME") totalIncome += amt;
			else if (tx.type === "EXPENSE") totalExpense += amt;
		}
		return {
			statusCode: 200,
			success: true,
			data: {
				totalIncome,
				totalExpense,
				balance: totalIncome - totalExpense,
				currency: "USD",
			} as T,
		};
	}

	if (pathname === "/finances/analytics" && method === "GET") {
		const finances = getList(STORAGE_KEYS.FINANCES);
		let income = 0;
		let expense = 0;
		const expenseCatTotals: Record<string, number> = {};
		const incomeCatTotals: Record<string, number> = {};

		for (const tx of finances) {
			const amt = Number(tx.amount) || 0;
			if (tx.type === "INCOME") {
				income += amt;
				const cat = String(tx.category || "General Income");
				incomeCatTotals[cat] = (incomeCatTotals[cat] || 0) + amt;
			}
			if (tx.type === "EXPENSE") {
				expense += amt;
				const cat = String(tx.category || "General Expense");
				expenseCatTotals[cat] = (expenseCatTotals[cat] || 0) + amt;
			}
		}

		const expenseCategories = Object.entries(expenseCatTotals).map(([category, amount]) => ({
			category,
			amount,
			percentage: expense > 0 ? Math.round((amount / expense) * 100) : 0,
		}));

		const incomeCategories = Object.entries(incomeCatTotals).map(([category, amount]) => ({
			category,
			amount,
			percentage: income > 0 ? Math.round((amount / income) * 100) : 0,
		}));

		const netBalance = income - expense;
		const savingsRate = income > 0 ? Math.max(0, Math.round((netBalance / income) * 100)) : 0;

		return {
			statusCode: 200,
			success: true,
			data: {
				totalIncome: income,
				totalExpense: expense,
				netBalance,
				savingsRate,
				expenseCategories,
				incomeCategories,
				timeline: [],
			} as T,
		};
	}

	const financeMatch = pathname.match(/^\/finances\/([^/]+)$/);
	if (financeMatch && !pathname.includes("summary") && !pathname.includes("analytics")) {
		const txId = financeMatch[1];
		const finances = getList(STORAGE_KEYS.FINANCES);
		const idx = finances.findIndex((t) => t.id === txId);

		if (idx >= 0) {
			if (method === "PATCH") {
				finances[idx] = { ...finances[idx], ...body, updatedAt: new Date().toISOString() };
				saveList(STORAGE_KEYS.FINANCES, finances);
				return { statusCode: 200, success: true, data: finances[idx] as T };
			}
			if (method === "DELETE") {
				const deleted = finances.splice(idx, 1)[0];
				saveList(STORAGE_KEYS.FINANCES, finances);
				return { statusCode: 200, success: true, data: deleted as T };
			}
		}
	}

	// 5. Debt & Loan routes
	if (pathname === "/debts-loans") {
		if (method === "GET") {
			const list = getList(STORAGE_KEYS.DEBTS_LOANS);
			const repayments = getList(STORAGE_KEYS.REPAYMENTS);
			const withRepayments = list.map((item) => ({
				...item,
				repayments: repayments.filter((r) => r.debtLoanId === item.id),
			}));
			return { statusCode: 200, success: true, data: withRepayments as T };
		}
		if (method === "POST") {
			const list = getList(STORAGE_KEYS.DEBTS_LOANS);
			const newItem = {
				id: generateId("dl"),
				userId: getActiveUserId(),
				type: body.type || "DEBT",
				personName: body.personName || "Unknown",
				amount: Number(body.amount) || 0,
				paidAmount: 0,
				status: "ACTIVE",
				date: body.date || new Date().toISOString(),
				dueDate: body.dueDate || null,
				description: body.description || null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				repayments: [],
			};
			list.unshift(newItem);
			saveList(STORAGE_KEYS.DEBTS_LOANS, list);

			// Add finance transaction automatically
			const finances = getList(STORAGE_KEYS.FINANCES);
			const isDebt = newItem.type === "DEBT";
			finances.unshift({
				id: generateId("tx"),
				userId: getActiveUserId(),
				type: isDebt ? "INCOME" : "EXPENSE",
				amount: newItem.amount,
				category: isDebt ? "Debt (Borrowed)" : "Loan (Lent)",
				description: `${isDebt ? "Borrowed from" : "Lent to"} ${newItem.personName}`,
				paymentMethod: "Cash",
				date: newItem.date,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});
			saveList(STORAGE_KEYS.FINANCES, finances);

			return { statusCode: 201, success: true, data: newItem as T };
		}
	}

	const dlRepaymentMatch = pathname.match(/^\/debts-loans\/([^/]+)\/repayments$/);
	if (dlRepaymentMatch && method === "POST") {
		const debtLoanId = dlRepaymentMatch[1];
		const list = getList(STORAGE_KEYS.DEBTS_LOANS);
		const idx = list.findIndex((i) => i.id === debtLoanId);
		if (idx >= 0) {
			const item = list[idx];
			const repayAmount = Number(body.amount) || 0;
			const repayments = getList(STORAGE_KEYS.REPAYMENTS);
			const newRepayment = {
				id: generateId("rep"),
				debtLoanId,
				userId: getActiveUserId(),
				amount: repayAmount,
				date: body.date || new Date().toISOString(),
				paymentMethod: body.paymentMethod || "Cash",
				notes: body.notes || null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			repayments.unshift(newRepayment);
			saveList(STORAGE_KEYS.REPAYMENTS, repayments);

			const updatedPaid = Number(item.paidAmount || 0) + repayAmount;
			list[idx] = {
				...item,
				paidAmount: updatedPaid,
				status: updatedPaid >= Number(item.amount) ? "SETTLED" : "ACTIVE",
				updatedAt: new Date().toISOString(),
			};
			saveList(STORAGE_KEYS.DEBTS_LOANS, list);

			// Add finance transaction for repayment
			const finances = getList(STORAGE_KEYS.FINANCES);
			const isDebt = item.type === "DEBT";
			finances.unshift({
				id: generateId("tx"),
				userId: getActiveUserId(),
				type: isDebt ? "EXPENSE" : "INCOME",
				amount: repayAmount,
				category: isDebt ? "Debt Repayment" : "Loan Received",
				description: `Repayment for ${item.personName}`,
				paymentMethod: newRepayment.paymentMethod,
				date: newRepayment.date,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});
			saveList(STORAGE_KEYS.FINANCES, finances);

			return { statusCode: 201, success: true, data: newRepayment as T };
		}
	}

	// 6. Categories
	if (pathname === "/categories") {
		let categories = getList(STORAGE_KEYS.CATEGORIES);
		if (categories.length === 0) {
			categories = [...DEFAULT_CATEGORIES];
			saveList(STORAGE_KEYS.CATEGORIES, categories);
		}
		if (method === "GET") {
			return { statusCode: 200, success: true, data: categories as T };
		}
		if (method === "POST") {
			const newCat = {
				id: generateId("cat"),
				name: body.name || "New Category",
				group: body.group || "EXPENSE",
				color: body.color || "#60a5fa",
			};
			categories.push(newCat);
			saveList(STORAGE_KEYS.CATEGORIES, categories);
			return { statusCode: 201, success: true, data: newCat as T };
		}
	}

	// 7. Trackers
	if (pathname === "/trackers") {
		if (method === "GET") {
			const trackers = getList(STORAGE_KEYS.TRACKERS);
			return { statusCode: 200, success: true, data: trackers as T };
		}
		if (method === "POST") {
			const trackers = getList(STORAGE_KEYS.TRACKERS);
			const newTrk = {
				id: generateId("trk"),
				userId: getActiveUserId(),
				name: body.name || "Tracker",
				category: body.category || "General",
				unitName: body.unitName || "units",
				defaultTarget: Number(body.defaultTarget) || 1,
				unitPrice: body.unitPrice ? Number(body.unitPrice) : null,
				currency: "USD",
				description: body.description || null,
				color: body.color || "emerald",
				isArchived: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			trackers.push(newTrk);
			saveList(STORAGE_KEYS.TRACKERS, trackers);
			return { statusCode: 201, success: true, data: newTrk as T };
		}
	}

	if (pathname === "/trackers/logs" && method === "GET") {
		const logs = getList(STORAGE_KEYS.TRACKER_LOGS);
		return { statusCode: 200, success: true, data: logs as T };
	}

	const trackerLogMatch = pathname.match(/^\/trackers\/([^/]+)\/logs$/);
	if (trackerLogMatch && method === "POST") {
		const trackerId = trackerLogMatch[1];
		const logs = getList(STORAGE_KEYS.TRACKER_LOGS);
		const date = String(body.date || new Date().toISOString().split("T")[0]);
		const existingIdx = logs.findIndex((l) => l.trackerId === trackerId && l.date === date);

		const entry = {
			id: existingIdx >= 0 ? logs[existingIdx].id : generateId("trkl"),
			trackerId,
			userId: getActiveUserId(),
			date,
			value: Number(body.value) || 0,
			status: body.status || "LOGGED",
			notes: body.notes || null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		if (existingIdx >= 0) {
			logs[existingIdx] = entry;
		} else {
			logs.push(entry);
		}
		saveList(STORAGE_KEYS.TRACKER_LOGS, logs);
		return { statusCode: 201, success: true, data: entry as T };
	}

	// 7. Sync & Backup Archive routes
	if (pathname === "/sync/archive/export" && method === "POST") {
		const exportRes = await exportLocalArchive();
		return {
			statusCode: 200,
			success: true,
			message: "Backup archive generated successfully",
			data: exportRes as T,
		};
	}

	if (pathname === "/sync/archive/restore" && method === "POST") {
		const archiveBase64 = String(body.archiveBase64 || body.archive || "");
		const restoreRes = await restoreLocalArchive(archiveBase64);
		return {
			statusCode: 200,
			success: true,
			message: restoreRes.message,
			data: {
				restoredCounts: restoreRes.counts,
				summary: restoreRes.message,
			} as T,
		};
	}

	if (pathname === "/sync/restore" && method === "POST") {
		const restoreRes = await restoreLocalArchive(undefined, body);
		return {
			statusCode: 200,
			success: true,
			message: restoreRes.message,
			data: { summary: restoreRes.message } as T,
		};
	}

	if (pathname === "/sync/auth-url" && method === "GET") {
		return {
			statusCode: 400,
			success: false,
			message:
				"Google Drive cloud sync requires a running DayPulse server. Use 'Multi-Collection ZIP Archive & Offline Backup' for device backups.",
			data: null as unknown as T,
		};
	}

	if (pathname === "/auth/google/restore-url") {
		return {
			statusCode: 400,
			success: false,
			message:
				"Google Drive cloud recovery requires an online server connection. Use 'File Backup' to restore your data offline.",
			data: null as unknown as T,
		};
	}

	if (pathname === "/auth/google/credentials" || pathname === "/sync/google/credentials") {
		return {
			statusCode: 200,
			success: true,
			data: { configured: false } as unknown as T,
		};
	}

	// 8. Health check
	if (pathname === "/health") {
		return { statusCode: 200, success: true, data: { status: "ok" } as T };
	}

	// Fallback success for unhandled routes in offline client mode
	return {
		statusCode: 200,
		success: true,
		data: null as unknown as T,
	};
}
