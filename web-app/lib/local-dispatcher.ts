import type { ApiResponse } from "./api-client";
import {
	clearClientGoogleTokens,
	exchangeClientCodeForTokens,
	executeClientBidirectionalSync,
	getClientGoogleAuthUrl,
	getClientGoogleCredentials,
	getClientGoogleStatus,
	getClientGoogleTokens,
	getLatestClientRestoreResult,
	isClientGoogleConfigured,
	restoreGoogleDriveBackup,
	saveClientGoogleCredentials,
	uploadBackupToGoogleDrive,
} from "./client-google-sync";
import { exportLocalArchive } from "./export-local-archive";
import { calculateLocalFinanceAnalytics } from "./local-finance-analytics";
import { buildLocalTrackerMonthDetail, formatTrackerWithMonthStats } from "./local-tracker-stats";
import { restoreLocalArchive } from "./restore-local-archive";

export interface LocalDebtLoanRecord {
	id: string;
	userId?: string;
	type?: string;
	personName?: string;
	amount?: number;
	paidAmount?: number;
	remainingAmount?: number;
	status?: string;
	date?: string;
	dueDate?: string | null;
	description?: string | null;
	initialTransactionId?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface LocalRepaymentRecord {
	id: string;
	debtLoanId: string;
	userId?: string;
	amount?: number;
	date?: string;
	paymentMethod?: string;
	notes?: string | null;
	transactionId?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

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
				remindBeforeMinutes:
					body.remindBeforeMinutes !== undefined && body.remindBeforeMinutes !== null
						? Number(body.remindBeforeMinutes)
						: 0,
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
	if (pathname === "/finances" || pathname === "/finances/transactions") {
		if (method === "GET") {
			let finances = getList<Record<string, unknown>>(STORAGE_KEYS.FINANCES);

			if (query.type && ["EXPENSE", "INCOME"].includes(query.type.toUpperCase())) {
				finances = finances.filter(
					(t) => String(t.type || "").toUpperCase() === query.type.toUpperCase(),
				);
			}
			if (query.category) {
				finances = finances.filter((t) => t.category === query.category);
			}
			if (query.startDate) {
				const start = new Date(query.startDate).getTime();
				finances = finances.filter((t) => new Date(String(t.date)).getTime() >= start);
			}
			if (query.endDate) {
				const end = new Date(query.endDate).getTime();
				finances = finances.filter((t) => new Date(String(t.date)).getTime() <= end);
			}

			finances.sort(
				(a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime(),
			);

			const limit = query.limit ? Number(query.limit) : undefined;
			const data = limit ? finances.slice(0, limit) : finances;

			return {
				statusCode: 200,
				success: true,
				data: data as T,
				meta: {
					page: 1,
					limit: limit || data.length,
					totalData: finances.length,
					totalPage: 1,
				},
			};
		}
		if (method === "POST") {
			const finances = getList<Record<string, unknown>>(STORAGE_KEYS.FINANCES);
			const newTx = {
				id: generateId("tx"),
				userId: getActiveUserId(),
				type: String(body.type || "EXPENSE").toUpperCase(),
				amount: Number(body.amount) || 0,
				category: String(body.category || "General"),
				description: typeof body.description === "string" ? body.description : "",
				paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : "Cash",
				date: body.date ? new Date(String(body.date)).toISOString() : new Date().toISOString(),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			finances.unshift(newTx);
			saveList(STORAGE_KEYS.FINANCES, finances);
			return { statusCode: 201, success: true, data: newTx as T };
		}
		if (method === "DELETE") {
			saveList(STORAGE_KEYS.FINANCES, []);
			return {
				statusCode: 200,
				success: true,
				message: "All transactions deleted",
				data: null as unknown as T,
			};
		}
	}

	if (pathname === "/finances/summary" && method === "GET") {
		const finances = getList<Record<string, unknown>>(STORAGE_KEYS.FINANCES);
		let totalIncome = 0;
		let totalExpense = 0;
		const categoryBreakdown: Record<string, number> = {};

		for (const tx of finances) {
			const amt = Number(tx.amount) || 0;
			const cat = String(tx.category || "General");
			if (String(tx.type).toUpperCase() === "INCOME") {
				totalIncome += amt;
			} else {
				totalExpense += amt;
				categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
			}
		}
		return {
			statusCode: 200,
			success: true,
			data: {
				totalIncome,
				totalExpense,
				netSavings: totalIncome - totalExpense,
				balance: totalIncome - totalExpense,
				categoryBreakdown,
				currency: "USD",
			} as T,
		};
	}

	if (pathname === "/finances/analytics" && method === "GET") {
		const finances = getList<Record<string, unknown>>(STORAGE_KEYS.FINANCES);
		const analytics = calculateLocalFinanceAnalytics(finances, query.period || "month", query.date);
		return {
			statusCode: 200,
			success: true,
			data: analytics as T,
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
		const list = getList<LocalDebtLoanRecord>(STORAGE_KEYS.DEBTS_LOANS);
		const repayments = getList<LocalRepaymentRecord>(STORAGE_KEYS.REPAYMENTS);

		if (method === "GET") {
			const typeFilter = query.type ? query.type.toUpperCase() : "ALL";
			const statusFilter = query.status ? query.status.toUpperCase() : "ALL";
			const search = (query.search || "").trim().toLowerCase();

			const formattedList = list.map((item) => {
				const amount = Number(item.amount) || 0;
				const paidAmount = Number(item.paidAmount) || 0;
				const remainingAmount = Math.max(0, Number((amount - paidAmount).toFixed(2)));
				const itemRepayments = repayments
					.filter((r) => r.debtLoanId === item.id)
					.map((r) => ({
						...r,
						amount: Number(r.amount) || 0,
						date: typeof r.date === "string" ? r.date : new Date().toISOString(),
					}))
					.sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime());

				return {
					...item,
					amount,
					paidAmount,
					remainingAmount,
					status: item.status === "SETTLED" || remainingAmount <= 0 ? "SETTLED" : "ACTIVE",
					date: typeof item.date === "string" ? item.date : new Date().toISOString(),
					dueDate: item.dueDate ? String(item.dueDate) : null,
					description: item.description ? String(item.description) : null,
					repayments: itemRepayments,
				};
			});

			let totalDebt = 0;
			let totalLoan = 0;
			let activeDebtCount = 0;
			let activeLoanCount = 0;
			let settledCount = 0;
			let totalSettledAmount = 0;

			for (const item of formattedList) {
				const rem = Number(item.remainingAmount) || 0;
				const amt = Number(item.amount) || 0;
				if (item.status === "SETTLED") {
					settledCount += 1;
					totalSettledAmount += amt;
				} else if (item.type === "DEBT") {
					activeDebtCount += 1;
					totalDebt += rem;
				} else if (item.type === "LOAN") {
					activeLoanCount += 1;
					totalLoan += rem;
				}
			}

			const filtered = formattedList.filter((item) => {
				if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
				if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
				if (search) {
					const nameMatch = String(item.personName || "")
						.toLowerCase()
						.includes(search);
					const descMatch = String(item.description || "")
						.toLowerCase()
						.includes(search);
					if (!nameMatch && !descMatch) return false;
				}
				return true;
			});

			return {
				statusCode: 200,
				success: true,
				data: {
					debtsLoans: filtered,
					summary: {
						totalDebt: Number(totalDebt.toFixed(2)),
						totalLoan: Number(totalLoan.toFixed(2)),
						netBalance: Number((totalLoan - totalDebt).toFixed(2)),
						activeDebtCount,
						activeLoanCount,
						settledCount,
						totalSettledAmount: Number(totalSettledAmount.toFixed(2)),
					},
				} as T,
			};
		}

		if (method === "POST") {
			const rawType = String(body.type || "DEBT").toUpperCase();
			const type = rawType === "LOAN" ? "LOAN" : "DEBT";
			const personName = String(body.personName || "Unknown").trim();
			const amount = Number(body.amount) || 0;
			const description = typeof body.description === "string" ? body.description.trim() : null;
			const paymentMethod =
				typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "Cash";
			const txDate = body.date
				? new Date(String(body.date)).toISOString()
				: new Date().toISOString();
			const dueDate = body.dueDate ? new Date(String(body.dueDate)).toISOString() : null;

			const isDebt = type === "DEBT";
			const txType = isDebt ? "INCOME" : "EXPENSE";
			const txCategory = isDebt ? "Debt / Borrowed" : "Loan Given";
			const txDesc = isDebt
				? `Borrowed from ${personName}${description ? ` - ${description}` : ""}`
				: `Loan to ${personName}${description ? ` - ${description}` : ""}`;

			const txId = generateId("tx");
			const finances = getList(STORAGE_KEYS.FINANCES);
			finances.unshift({
				id: txId,
				userId: getActiveUserId(),
				type: txType,
				amount,
				category: txCategory,
				description: txDesc,
				paymentMethod,
				date: txDate,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});
			saveList(STORAGE_KEYS.FINANCES, finances);

			const newItem = {
				id: generateId("dl"),
				userId: getActiveUserId(),
				type,
				personName,
				amount,
				paidAmount: 0,
				remainingAmount: amount,
				status: "ACTIVE",
				date: txDate,
				dueDate,
				description,
				initialTransactionId: txId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				repayments: [],
			};
			list.unshift(newItem);
			saveList(STORAGE_KEYS.DEBTS_LOANS, list);

			return {
				statusCode: 201,
				success: true,
				message: `${isDebt ? "Debt" : "Loan"} recorded successfully`,
				data: newItem as T,
			};
		}
	}

	const dlRepayMatch = pathname.match(/^\/debts-loans\/([^/]+)\/repay$/);
	if (dlRepayMatch && method === "POST") {
		const debtLoanId = dlRepayMatch[1];
		const list = getList<LocalDebtLoanRecord>(STORAGE_KEYS.DEBTS_LOANS);
		const idx = list.findIndex((i) => i.id === debtLoanId);
		if (idx >= 0) {
			const item = list[idx];
			const totalAmount = Number(item.amount) || 0;
			const currentPaid = Number(item.paidAmount) || 0;
			const remaining = Math.max(0, totalAmount - currentPaid);

			const inputAmount = Number(body.amount) || 0;
			const repayAmount = Number(Math.min(inputAmount, remaining).toFixed(2));
			if (repayAmount <= 0) {
				return {
					statusCode: 400,
					success: false,
					message: "Debt or loan is already completely settled",
					data: null as unknown as T,
				};
			}

			const notes = typeof body.notes === "string" ? body.notes.trim() : null;
			const paymentMethod =
				typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "Cash";
			const repayDate = body.date
				? new Date(String(body.date)).toISOString()
				: new Date().toISOString();

			const isDebt = item.type === "DEBT";
			const txType = isDebt ? "EXPENSE" : "INCOME";
			const txCategory = isDebt ? "Debt Repayment" : "Loan Return";
			const txDesc = isDebt
				? `Debt repayment to ${item.personName}${notes ? ` - ${notes}` : ""}`
				: `Loan return from ${item.personName}${notes ? ` - ${notes}` : ""}`;

			const txId = generateId("tx");
			const finances = getList(STORAGE_KEYS.FINANCES);
			finances.unshift({
				id: txId,
				userId: getActiveUserId(),
				type: txType,
				amount: repayAmount,
				category: txCategory,
				description: txDesc,
				paymentMethod,
				date: repayDate,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});
			saveList(STORAGE_KEYS.FINANCES, finances);

			const repayments = getList<LocalRepaymentRecord>(STORAGE_KEYS.REPAYMENTS);
			const newRepayment = {
				id: generateId("rep"),
				debtLoanId,
				userId: getActiveUserId(),
				amount: repayAmount,
				date: repayDate,
				paymentMethod,
				notes,
				transactionId: txId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			repayments.unshift(newRepayment);
			saveList(STORAGE_KEYS.REPAYMENTS, repayments);

			const newPaidAmount = Number((currentPaid + repayAmount).toFixed(2));
			const isSettled = newPaidAmount >= totalAmount;

			list[idx] = {
				...item,
				paidAmount: newPaidAmount,
				remainingAmount: Math.max(0, Number((totalAmount - newPaidAmount).toFixed(2))),
				status: isSettled ? "SETTLED" : "ACTIVE",
				updatedAt: new Date().toISOString(),
			};
			saveList(STORAGE_KEYS.DEBTS_LOANS, list);

			const itemRepayments = repayments
				.filter((r) => r.debtLoanId === debtLoanId)
				.map((r) => ({
					...r,
					amount: Number(r.amount) || 0,
					date: typeof r.date === "string" ? r.date : new Date().toISOString(),
				}));

			const serialized = {
				...list[idx],
				amount: totalAmount,
				paidAmount: newPaidAmount,
				remainingAmount: Math.max(0, Number((totalAmount - newPaidAmount).toFixed(2))),
				status: isSettled ? "SETTLED" : "ACTIVE",
				repayments: itemRepayments,
			};

			return {
				statusCode: 201,
				success: true,
				message: `Repayment of ${repayAmount} recorded successfully`,
				data: {
					debtLoan: serialized,
					repayment: newRepayment,
				} as T,
			};
		}
	}

	const dlRepaymentDeleteMatch = pathname.match(/^\/debts-loans\/([^/]+)\/repayments\/([^/]+)$/);
	if (dlRepaymentDeleteMatch && method === "DELETE") {
		const debtLoanId = dlRepaymentDeleteMatch[1];
		const repaymentId = dlRepaymentDeleteMatch[2];

		const repayments = getList<LocalRepaymentRecord>(STORAGE_KEYS.REPAYMENTS);
		const repIdx = repayments.findIndex((r) => r.id === repaymentId && r.debtLoanId === debtLoanId);
		if (repIdx >= 0) {
			const rep = repayments.splice(repIdx, 1)[0];
			saveList(STORAGE_KEYS.REPAYMENTS, repayments);

			if (rep.transactionId) {
				const finances = getList(STORAGE_KEYS.FINANCES);
				const txIdx = finances.findIndex((f) => f.id === rep.transactionId);
				if (txIdx >= 0) {
					finances.splice(txIdx, 1);
					saveList(STORAGE_KEYS.FINANCES, finances);
				}
			}

			const list = getList<LocalDebtLoanRecord>(STORAGE_KEYS.DEBTS_LOANS);
			const itemIdx = list.findIndex((i) => i.id === debtLoanId);
			if (itemIdx >= 0) {
				const item = list[itemIdx];
				const total = Number(item.amount) || 0;
				const currentPaid = Number(item.paidAmount) || 0;
				const newPaid = Math.max(0, Number((currentPaid - Number(rep.amount)).toFixed(2)));
				list[itemIdx] = {
					...item,
					paidAmount: newPaid,
					remainingAmount: Math.max(0, Number((total - newPaid).toFixed(2))),
					status: newPaid >= total ? "SETTLED" : "ACTIVE",
					updatedAt: new Date().toISOString(),
				};
				saveList(STORAGE_KEYS.DEBTS_LOANS, list);
			}

			return {
				statusCode: 200,
				success: true,
				message: "Repayment reversed",
				data: null as unknown as T,
			};
		}
	}

	const singleDlMatch = pathname.match(/^\/debts-loans\/([^/]+)$/);
	if (singleDlMatch && !pathname.endsWith("/repay")) {
		const debtLoanId = singleDlMatch[1];
		const list = getList<LocalDebtLoanRecord>(STORAGE_KEYS.DEBTS_LOANS);
		const idx = list.findIndex((i) => i.id === debtLoanId);

		if (idx >= 0) {
			const repayments = getList<LocalRepaymentRecord>(STORAGE_KEYS.REPAYMENTS);
			const existing = list[idx];
			const totalAmount = Number(existing.amount) || 0;
			const paidAmount = Number(existing.paidAmount) || 0;

			if (method === "GET") {
				const itemRepayments = repayments.filter((r) => r.debtLoanId === debtLoanId);
				const serialized = {
					...existing,
					amount: totalAmount,
					paidAmount,
					remainingAmount: Math.max(0, Number((totalAmount - paidAmount).toFixed(2))),
					repayments: itemRepayments,
				};
				return { statusCode: 200, success: true, data: serialized as T };
			}

			if (method === "PATCH") {
				const updated = {
					...existing,
					personName:
						typeof body.personName === "string" && body.personName.trim()
							? body.personName.trim()
							: existing.personName,
					description:
						body.description !== undefined
							? typeof body.description === "string"
								? body.description.trim()
								: null
							: existing.description,
					dueDate:
						body.dueDate !== undefined
							? body.dueDate
								? String(body.dueDate)
								: null
							: existing.dueDate,
					date: body.date ? String(body.date) : existing.date,
					status:
						body.status === "ACTIVE" || body.status === "SETTLED" ? body.status : existing.status,
					updatedAt: new Date().toISOString(),
				};
				list[idx] = updated;
				saveList(STORAGE_KEYS.DEBTS_LOANS, list);

				if (existing.initialTransactionId && (body.personName || body.description !== undefined)) {
					const finances = getList(STORAGE_KEYS.FINANCES);
					const txIdx = finances.findIndex((f) => f.id === existing.initialTransactionId);
					if (txIdx >= 0) {
						const isDebt = existing.type === "DEBT";
						const nextName = updated.personName;
						const nextDesc = updated.description;
						finances[txIdx] = {
							...finances[txIdx],
							description: isDebt
								? `Borrowed from ${nextName}${nextDesc ? ` - ${nextDesc}` : ""}`
								: `Loan to ${nextName}${nextDesc ? ` - ${nextDesc}` : ""}`,
							updatedAt: new Date().toISOString(),
						};
						saveList(STORAGE_KEYS.FINANCES, finances);
					}
				}

				const itemRepayments = repayments.filter((r) => r.debtLoanId === debtLoanId);
				const serialized = {
					...updated,
					amount: totalAmount,
					paidAmount,
					remainingAmount: Math.max(0, Number((totalAmount - paidAmount).toFixed(2))),
					repayments: itemRepayments,
				};
				return { statusCode: 200, success: true, data: serialized as T };
			}

			if (method === "DELETE") {
				list.splice(idx, 1);
				saveList(STORAGE_KEYS.DEBTS_LOANS, list);

				if (existing.initialTransactionId) {
					const finances = getList(STORAGE_KEYS.FINANCES);
					const filteredFinances = finances.filter((f) => f.id !== existing.initialTransactionId);
					saveList(STORAGE_KEYS.FINANCES, filteredFinances);
				}

				const repTxIds = new Set(
					repayments
						.filter((r) => r.debtLoanId === debtLoanId && typeof r.transactionId === "string")
						.map((r) => r.transactionId as string),
				);
				const remainingReps = repayments.filter((r) => r.debtLoanId !== debtLoanId);
				saveList(STORAGE_KEYS.REPAYMENTS, remainingReps);

				if (repTxIds.size > 0) {
					const finances = getList(STORAGE_KEYS.FINANCES);
					const filteredFinances = finances.filter(
						(f) => typeof f.id !== "string" || !repTxIds.has(f.id),
					);
					saveList(STORAGE_KEYS.FINANCES, filteredFinances);
				}

				return {
					statusCode: 200,
					success: true,
					message: "Debt or loan and linked transactions deleted",
					data: null as unknown as T,
				};
			}
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
			const trackers = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKERS).filter(
				(t) => !t.isArchived,
			);
			const allLogs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS);
			const targetDate = query.date || new Date().toISOString().slice(0, 10);

			const formatted = trackers.map((t) => formatTrackerWithMonthStats(t, allLogs, targetDate));
			return { statusCode: 200, success: true, data: formatted as T };
		}
		if (method === "POST") {
			const trackers = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKERS);
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
		if (method === "DELETE") {
			saveList(STORAGE_KEYS.TRACKER_LOGS, []);
			saveList(STORAGE_KEYS.TRACKERS, []);
			return {
				statusCode: 200,
				success: true,
				message: "All trackers deleted",
				data: null as unknown as T,
			};
		}
	}

	if (pathname === "/trackers/logs" && method === "GET") {
		const logs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS);
		return { statusCode: 200, success: true, data: logs as T };
	}

	const trackerSettleMatch = pathname.match(/^\/trackers\/([^/]+)\/settle$/);
	if (trackerSettleMatch && method === "POST") {
		const trackerId = trackerSettleMatch[1];
		const trackers = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKERS);
		const tracker = trackers.find((t) => t.id === trackerId);
		if (!tracker) {
			return {
				statusCode: 404,
				success: false,
				message: "Tracker not found",
				data: null as unknown as T,
			};
		}

		const startDate = String(body.startDate || "");
		const endDate = String(body.endDate || "");
		const logs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS);

		const unsettledLogs = logs.filter(
			(l) =>
				l.trackerId === trackerId &&
				typeof l.date === "string" &&
				l.date >= startDate &&
				l.date <= endDate &&
				!l.isSettled &&
				(Number(l.value) || 0) > 0,
		);

		if (unsettledLogs.length === 0) {
			return {
				statusCode: 400,
				success: false,
				message: "No unsettled items found for the selected period.",
				data: null as unknown as T,
			};
		}

		let totalAmount = 0;
		let totalUnits = 0;
		const nowIso = new Date().toISOString();

		for (const log of unsettledLogs) {
			const val = Number(log.value) || 0;
			const rate =
				typeof log.unitPrice === "number"
					? log.unitPrice
					: typeof tracker.unitPrice === "number"
						? (tracker.unitPrice as number)
						: 0;
			totalAmount += val * rate;
			totalUnits += val;

			log.isSettled = true;
			log.settledAt = nowIso;
			log.updatedAt = nowIso;
		}
		totalAmount = Number(totalAmount.toFixed(2));
		saveList(STORAGE_KEYS.TRACKER_LOGS, logs);

		const settlementDescription =
			typeof body.notes === "string" && body.notes
				? body.notes
				: `Settlement: ${tracker.name} (${totalUnits} ${tracker.unitName}, ${startDate} to ${endDate})`;

		const finances = getList<Record<string, unknown>>(STORAGE_KEYS.FINANCES);
		const newTx = {
			id: generateId("tx"),
			userId: getActiveUserId(),
			type: "EXPENSE",
			amount: totalAmount,
			category:
				typeof body.category === "string"
					? body.category
					: (tracker.category as string) || "Food & Dining",
			description: settlementDescription,
			paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : "Cash",
			date: nowIso,
			createdAt: nowIso,
			updatedAt: nowIso,
		};
		finances.unshift(newTx);
		saveList(STORAGE_KEYS.FINANCES, finances);

		return {
			statusCode: 200,
			success: true,
			message: "Tracker settlement recorded in finances.",
			data: {
				transaction: newTx,
				settledLogsCount: unsettledLogs.length,
				totalAmount,
				totalUnits,
			} as T,
		};
	}

	const trackerLogMatch = pathname.match(/^\/trackers\/([^/]+)\/logs?$/);
	if (trackerLogMatch) {
		const trackerId = trackerLogMatch[1];
		if (method === "GET") {
			const logs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS).filter(
				(l) => l.trackerId === trackerId,
			);
			logs.sort((a, b) => String(b.date).localeCompare(String(a.date)));
			return { statusCode: 200, success: true, data: logs as T };
		}
		if (method === "POST") {
			const logs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS);
			const date = String(body.date || new Date().toISOString().split("T")[0]);
			const existingIdx = logs.findIndex((l) => l.trackerId === trackerId && l.date === date);

			const entry = {
				id: existingIdx >= 0 ? logs[existingIdx].id : generateId("trkl"),
				trackerId,
				userId: getActiveUserId(),
				date,
				value: Number(body.value) || 0,
				status: body.status || "LOGGED",
				unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : undefined,
				notes: body.notes !== undefined ? (body.notes ? String(body.notes) : null) : null,
				isSettled: existingIdx >= 0 ? Boolean(logs[existingIdx].isSettled) : false,
				settledAt: existingIdx >= 0 ? logs[existingIdx].settledAt : null,
				createdAt: existingIdx >= 0 ? logs[existingIdx].createdAt : new Date().toISOString(),
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
	}

	const trackerSingleLogMatch = pathname.match(/^\/trackers\/([^/]+)\/logs?\/([^/]+)$/);
	if (trackerSingleLogMatch) {
		const logId = trackerSingleLogMatch[2];
		const logs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS);
		const idx = logs.findIndex((l) => l.id === logId);

		if (idx >= 0) {
			if (method === "PATCH") {
				logs[idx] = {
					...logs[idx],
					value: body.value !== undefined ? Number(body.value) : logs[idx].value,
					status: body.status !== undefined ? body.status : logs[idx].status,
					unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : logs[idx].unitPrice,
					notes:
						body.notes !== undefined ? (body.notes ? String(body.notes) : null) : logs[idx].notes,
					isSettled: body.isSettled !== undefined ? Boolean(body.isSettled) : logs[idx].isSettled,
					updatedAt: new Date().toISOString(),
				};
				saveList(STORAGE_KEYS.TRACKER_LOGS, logs);
				return { statusCode: 200, success: true, data: logs[idx] as T };
			}
			if (method === "DELETE") {
				const deleted = logs.splice(idx, 1)[0];
				saveList(STORAGE_KEYS.TRACKER_LOGS, logs);
				return { statusCode: 200, success: true, data: deleted as T };
			}
		}
	}

	const trackerMatch = pathname.match(/^\/trackers\/([^/]+)$/);
	if (
		trackerMatch &&
		!pathname.includes("settle") &&
		!pathname.includes("logs") &&
		!pathname.includes("log")
	) {
		const trackerId = trackerMatch[1];
		const trackers = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKERS);
		const trackerIdx = trackers.findIndex((t) => t.id === trackerId);

		if (trackerIdx < 0) {
			return {
				statusCode: 404,
				success: false,
				message: "Tracker not found",
				data: null as unknown as T,
			};
		}

		const tracker = trackers[trackerIdx];

		if (method === "GET") {
			const now = new Date();
			const targetYear = query.year ? Number(query.year) : now.getFullYear();
			const targetMonth = query.month ? Number(query.month) : now.getMonth() + 1;
			const allLogs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS);

			const detail = buildLocalTrackerMonthDetail(tracker, allLogs, targetYear, targetMonth);
			return { statusCode: 200, success: true, data: detail as T };
		}

		if (method === "PATCH") {
			trackers[trackerIdx] = {
				...trackers[trackerIdx],
				...body,
				defaultTarget:
					body.defaultTarget !== undefined
						? Number(body.defaultTarget)
						: trackers[trackerIdx].defaultTarget,
				unitPrice:
					body.unitPrice !== undefined
						? body.unitPrice
							? Number(body.unitPrice)
							: null
						: trackers[trackerIdx].unitPrice,
				updatedAt: new Date().toISOString(),
			};
			saveList(STORAGE_KEYS.TRACKERS, trackers);
			return { statusCode: 200, success: true, data: trackers[trackerIdx] as T };
		}

		if (method === "DELETE") {
			const deleted = trackers.splice(trackerIdx, 1)[0];
			saveList(STORAGE_KEYS.TRACKERS, trackers);
			const allLogs = getList<Record<string, unknown>>(STORAGE_KEYS.TRACKER_LOGS);
			const remainingLogs = allLogs.filter((l) => l.trackerId !== trackerId);
			saveList(STORAGE_KEYS.TRACKER_LOGS, remainingLogs);
			return { statusCode: 200, success: true, data: deleted as T };
		}
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

	if (
		(pathname === "/auth/google/credentials" || pathname === "/sync/google/credentials") &&
		method === "GET"
	) {
		const configured = isClientGoogleConfigured();
		const creds = getClientGoogleCredentials();
		return {
			statusCode: 200,
			success: true,
			data: {
				configured,
				clientId: creds?.clientId ? `${creds.clientId.slice(0, 12)}...` : "",
			} as unknown as T,
		};
	}

	if (
		(pathname === "/auth/google/credentials" || pathname === "/sync/google/credentials") &&
		method === "POST"
	) {
		const creds = body as { clientId?: string; clientSecret?: string };
		if (!creds?.clientId || !creds?.clientSecret) {
			return {
				statusCode: 400,
				success: false,
				message: "Both Client ID and Client Secret are required.",
				data: null as unknown as T,
			};
		}
		saveClientGoogleCredentials(creds.clientId, creds.clientSecret);
		return {
			statusCode: 200,
			success: true,
			message: "Google Drive OAuth credentials saved successfully.",
			data: { configured: true } as unknown as T,
		};
	}

	if (
		(pathname === "/auth/google/restore-url" || pathname === "/sync/auth-url") &&
		method === "GET"
	) {
		if (!isClientGoogleConfigured()) {
			return {
				statusCode: 400,
				success: false,
				message:
					"Google Drive sync is not configured. Provide your Google OAuth credentials or restore from a local backup file.",
				data: null as unknown as T,
			};
		}
		try {
			const url = getClientGoogleAuthUrl();
			return {
				statusCode: 200,
				success: true,
				data: { url, authUrl: url } as unknown as T,
			};
		} catch (err: unknown) {
			return {
				statusCode: 400,
				success: false,
				message: err instanceof Error ? err.message : "Failed to obtain Google authorization URL",
				data: null as unknown as T,
			};
		}
	}

	if (pathname === "/auth/google/restore-status" && method === "GET") {
		const result = getLatestClientRestoreResult();
		return {
			statusCode: 200,
			success: true,
			data: result as unknown as T,
		};
	}

	if (pathname === "/auth/google/restore-code" && method === "POST") {
		const code = String(body.code || "");
		if (!code) {
			return {
				statusCode: 400,
				success: false,
				message: "Authorization code is required.",
				data: null as unknown as T,
			};
		}
		try {
			await exchangeClientCodeForTokens(code);
			const restoreRes = await restoreGoogleDriveBackup();
			return {
				statusCode: 200,
				success: true,
				message: restoreRes.message,
				data: getLatestClientRestoreResult() as unknown as T,
			};
		} catch (err: unknown) {
			return {
				statusCode: 400,
				success: false,
				message: err instanceof Error ? err.message : "Failed to restore from Google Drive",
				data: null as unknown as T,
			};
		}
	}

	if (pathname === "/sync/google/exchange-code" && method === "POST") {
		const code = String(body.code || "");
		if (!code) {
			return {
				statusCode: 400,
				success: false,
				message: "Authorization code is required.",
				data: null as unknown as T,
			};
		}
		try {
			const tokenRes = await exchangeClientCodeForTokens(code);
			return {
				statusCode: 200,
				success: true,
				message: "Google account successfully connected.",
				data: tokenRes as unknown as T,
			};
		} catch (err: unknown) {
			return {
				statusCode: 400,
				success: false,
				message: err instanceof Error ? err.message : "Failed to exchange authorization code",
				data: null as unknown as T,
			};
		}
	}

	if ((pathname === "/sync/restore" || pathname === "/sync/google/restore") && method === "POST") {
		const hasPayload =
			body &&
			typeof body === "object" &&
			(body.archiveBase64 ||
				Array.isArray(body.tasks) ||
				Array.isArray(body.routines) ||
				Array.isArray(body.finances) ||
				Array.isArray(body.transactions) ||
				Array.isArray(body.trackers));

		if (!hasPayload || pathname === "/sync/google/restore") {
			try {
				const restoreRes = await restoreGoogleDriveBackup();
				return {
					statusCode: 200,
					success: true,
					message: restoreRes.message,
					data: { summary: restoreRes.message } as T,
				};
			} catch (err: unknown) {
				return {
					statusCode: 400,
					success: false,
					message: err instanceof Error ? err.message : "Failed to restore from Google Drive",
					data: null as unknown as T,
				};
			}
		}

		const restoreRes = await restoreLocalArchive(
			typeof body.archiveBase64 === "string" ? body.archiveBase64 : undefined,
			body,
		);
		return {
			statusCode: 200,
			success: true,
			message: restoreRes.message,
			data: { summary: restoreRes.message } as T,
		};
	}

	if (pathname === "/sync/bidirectional" && method === "POST") {
		try {
			const syncRes = await executeClientBidirectionalSync();
			return {
				statusCode: 200,
				success: true,
				message: syncRes.message,
				data: { lastSyncAt: syncRes.lastSyncAt } as T,
			};
		} catch (err: unknown) {
			return {
				statusCode: 500,
				success: false,
				message:
					err instanceof Error ? err.message : "Failed to execute two-way sync with Google Drive",
				data: null as unknown as T,
			};
		}
	}

	if (pathname === "/sync/upload" && method === "POST") {
		try {
			const uploadRes = await uploadBackupToGoogleDrive();
			return {
				statusCode: 200,
				success: true,
				message: uploadRes.message,
				data: { lastSyncAt: uploadRes.lastSyncAt } as T,
			};
		} catch (err: unknown) {
			return {
				statusCode: 500,
				success: false,
				message: err instanceof Error ? err.message : "Failed to backup to Google Drive",
				data: null as unknown as T,
			};
		}
	}

	if (pathname === "/sync/status" && method === "GET") {
		const configured = isClientGoogleConfigured();
		const tokens = getClientGoogleTokens();
		const status = getClientGoogleStatus();
		return {
			statusCode: 200,
			success: true,
			data: {
				isConfigured: configured,
				configured,
				isConnected: Boolean(tokens?.accessToken),
				connected: Boolean(tokens?.accessToken),
				email: tokens?.email || null,
				googleEmail: tokens?.email || null,
				lastSyncAt: status?.lastSyncAt || null,
				lastGoogleSyncAt: status?.lastSyncAt || null,
				stats: {
					tasks: getList(STORAGE_KEYS.TASKS).length,
					routines: getList(STORAGE_KEYS.ROUTINES).length,
					transactions: getList(STORAGE_KEYS.FINANCES).length,
					trackers: getList(STORAGE_KEYS.TRACKERS).length,
				},
			} as unknown as T,
		};
	}

	if (pathname === "/sync/disconnect" && method === "POST") {
		clearClientGoogleTokens();
		return {
			statusCode: 200,
			success: true,
			message: "Google account disconnected successfully",
			data: null as unknown as T,
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
