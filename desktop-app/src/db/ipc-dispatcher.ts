import { getCurrentUserId, getPrismaClient } from "./prisma-client.js";

export interface IpcApiRequest {
	endpoint: string;
	method?: string;
	body?: unknown;
	query?: Record<string, string>;
}

export interface IpcApiResponse<T = unknown> {
	statusCode: number;
	success: boolean;
	message?: string;
	data: T;
	meta?: {
		page: number;
		limit: number;
		totalData: number;
		totalPage: number;
	} | null;
}

export async function handleIpcApiDispatch(
	req: IpcApiRequest,
): Promise<IpcApiResponse> {
	const prisma = getPrismaClient();
	const userId = getCurrentUserId();

	const rawEndpoint = req.endpoint.replace(/^\/api\/v1/, "");
	const [pathname, queryString] = rawEndpoint.split("?");
	const method = (req.method || "GET").toUpperCase();
	const body = (req.body as Record<string, unknown>) || {};

	// Parse query params
	const query: Record<string, string> = { ...req.query };
	if (queryString) {
		const pairs = queryString.split("&");
		for (const p of pairs) {
			const [k, v] = p.split("=");
			if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || "");
		}
	}

	try {
		// ================= AUTH ROUTES =================
		if (pathname === "/auth/me" && method === "GET") {
			let user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) {
				user = await prisma.user.findFirst();
			}
			return {
				statusCode: 200,
				success: true,
				data: user,
			};
		}

		if (pathname === "/auth/me" && method === "PATCH") {
			const updated = await prisma.user.update({
				where: { id: userId },
				data: {
					name: typeof body.name === "string" ? body.name : undefined,
					currency:
						typeof body.currency === "string" ? body.currency : undefined,
				},
			});
			return { statusCode: 200, success: true, data: updated };
		}

		if (
			(pathname === "/auth/login" || pathname === "/auth/register") &&
			method === "POST"
		) {
			let user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) {
				user = await prisma.user.findFirst();
			}
			return {
				statusCode: 200,
				success: true,
				data: { user, token: "daypulse_standalone_token" },
			};
		}

		// ================= TASK ROUTES =================
		if (pathname === "/tasks" && method === "GET") {
			const where: Record<string, unknown> = { userId };
			if (query.upcoming === "true") {
				const startOfToday = new Date();
				startOfToday.setHours(0, 0, 0, 0);
				where.dueDate = { gte: startOfToday };
			}
			if (query.status) {
				where.status = query.status.toUpperCase();
			}
			if (query.priority) {
				where.priority = query.priority.toUpperCase();
			}
			if (query.type) {
				where.type = query.type.toUpperCase();
			}

			const tasks = await prisma.task.findMany({
				where,
				orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
			});
			return { statusCode: 200, success: true, data: tasks };
		}

		if (pathname === "/tasks" && method === "POST") {
			const task = await prisma.task.create({
				data: {
					userId,
					title: String(body.title || "Untitled Task"),
					description:
						typeof body.description === "string" ? body.description : null,
					type: typeof body.type === "string" ? body.type : "TASK",
					category:
						typeof body.category === "string" ? body.category : "General",
					priority:
						typeof body.priority === "string" ? body.priority : "MEDIUM",
					status: typeof body.status === "string" ? body.status : "PENDING",
					startDate: body.startDate ? new Date(String(body.startDate)) : null,
					dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
					remindBeforeMinutes: Number(body.remindBeforeMinutes) || 15,
					isRecurring: Boolean(body.isRecurring),
					repeatFrequency: body.repeatFrequency
						? String(body.repeatFrequency)
						: null,
					repeatInterval: Number(body.repeatInterval) || 1,
					repeatDaysOfWeek: body.repeatDaysOfWeek
						? String(body.repeatDaysOfWeek)
						: null,
					repeatTime: body.repeatTime ? String(body.repeatTime) : null,
					repeatDayOfMonth: body.repeatDayOfMonth
						? Number(body.repeatDayOfMonth)
						: null,
					repeatMonthOfYear: body.repeatMonthOfYear
						? Number(body.repeatMonthOfYear)
						: null,
					repeatEndType: body.repeatEndType ? String(body.repeatEndType) : null,
					repeatCount: body.repeatCount ? Number(body.repeatCount) : null,
					repeatUntil: body.repeatUntil
						? new Date(String(body.repeatUntil))
						: null,
				},
			});
			return { statusCode: 201, success: true, data: task };
		}

		const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
		if (taskMatch && method === "PATCH") {
			const taskId = taskMatch[1];
			const updated = await prisma.task.update({
				where: { id: taskId },
				data: {
					title: typeof body.title === "string" ? body.title : undefined,
					description:
						typeof body.description === "string" ? body.description : undefined,
					status: typeof body.status === "string" ? body.status : undefined,
					priority:
						typeof body.priority === "string" ? body.priority : undefined,
					category:
						typeof body.category === "string" ? body.category : undefined,
					type: typeof body.type === "string" ? body.type : undefined,
					startDate: body.startDate
						? new Date(String(body.startDate))
						: undefined,
					dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
					completedAt:
						body.status === "COMPLETED"
							? new Date()
							: body.status
								? null
								: undefined,
				},
			});
			return { statusCode: 200, success: true, data: updated };
		}

		if (taskMatch && method === "DELETE") {
			const taskId = taskMatch[1];
			await prisma.task.delete({ where: { id: taskId } });
			return { statusCode: 200, success: true, data: null };
		}

		// ================= ROUTINE ROUTES =================
		if (pathname === "/routines" && method === "GET") {
			const todayStr = new Date().toISOString().slice(0, 10);
			const routines = await prisma.routine.findMany({
				where: { userId },
				include: {
					logs: {
						where: { date: todayStr },
					},
				},
				orderBy: { createdAt: "desc" },
			});

			const formatted = routines.map((r) => ({
				...r,
				isCompletedToday: r.logs.length > 0 && r.logs[0].completed,
			}));

			return { statusCode: 200, success: true, data: formatted };
		}

		if (pathname === "/routines" && method === "POST") {
			const routine = await prisma.routine.create({
				data: {
					userId,
					title: String(body.title || "Routine"),
					description:
						typeof body.description === "string" ? body.description : null,
					timeSlot:
						typeof body.timeSlot === "string" ? body.timeSlot : "morning",
					targetTime:
						typeof body.targetTime === "string" ? body.targetTime : null,
					daysOfWeek:
						typeof body.daysOfWeek === "string"
							? body.daysOfWeek
							: "0,1,2,3,4,5,6",
					reminderMinutes: Number(body.reminderMinutes) || 0,
				},
			});
			return { statusCode: 201, success: true, data: routine };
		}

		const routineToggleMatch = pathname.match(/^\/routines\/([^/]+)\/toggle$/);
		if (routineToggleMatch && method === "POST") {
			const routineId = routineToggleMatch[1];
			const todayStr =
				typeof body.date === "string"
					? body.date
					: new Date().toISOString().slice(0, 10);

			const existingLog = await prisma.routineLog.findUnique({
				where: {
					routineId_date: {
						routineId,
						date: todayStr,
					},
				},
			});

			let isNowCompleted = true;
			if (existingLog) {
				isNowCompleted = !existingLog.completed;
				await prisma.routineLog.update({
					where: { id: existingLog.id },
					data: { completed: isNowCompleted },
				});
			} else {
				await prisma.routineLog.create({
					data: {
						routineId,
						userId,
						date: todayStr,
						completed: true,
					},
				});
			}

			// Update streak
			const routine = await prisma.routine.findUnique({
				where: { id: routineId },
			});
			if (routine) {
				const streakDelta = isNowCompleted ? 1 : -1;
				const newStreak = Math.max(0, routine.streakCount + streakDelta);
				await prisma.routine.update({
					where: { id: routineId },
					data: {
						streakCount: newStreak,
						lastCompletedDate: isNowCompleted
							? todayStr
							: routine.lastCompletedDate,
					},
				});
			}

			return {
				statusCode: 200,
				success: true,
				data: { routineId, completed: isNowCompleted, date: todayStr },
			};
		}

		const routineMatch = pathname.match(/^\/routines\/([^/]+)$/);
		if (routineMatch && method === "DELETE") {
			const routineId = routineMatch[1];
			await prisma.routine.delete({ where: { id: routineId } });
			return { statusCode: 200, success: true, data: null };
		}

		// ================= FINANCES ROUTES =================
		if (
			(pathname === "/finances/transactions" || pathname === "/finances") &&
			method === "GET"
		) {
			const transactions = await prisma.transaction.findMany({
				where: { userId },
				orderBy: { date: "desc" },
			});
			return { statusCode: 200, success: true, data: transactions };
		}

		if (pathname === "/finances/summary" && method === "GET") {
			const transactions = await prisma.transaction.findMany({
				where: { userId },
			});

			let totalIncome = 0;
			let totalExpense = 0;
			const categoryBreakdown: Record<string, number> = {};

			for (const t of transactions) {
				if (t.type.toUpperCase() === "INCOME") {
					totalIncome += t.amount;
				} else {
					totalExpense += t.amount;
					categoryBreakdown[t.category] =
						(categoryBreakdown[t.category] || 0) + t.amount;
				}
			}

			return {
				statusCode: 200,
				success: true,
				data: {
					totalIncome,
					totalExpense,
					netSavings: totalIncome - totalExpense,
					categoryBreakdown,
				},
			};
		}

		if (
			(pathname === "/finances/transactions" || pathname === "/finances") &&
			method === "POST"
		) {
			const tx = await prisma.transaction.create({
				data: {
					userId,
					type: String(body.type || "EXPENSE").toUpperCase(),
					amount: Number(body.amount) || 0,
					category: String(body.category || "General"),
					description:
						typeof body.description === "string" ? body.description : null,
					paymentMethod:
						typeof body.paymentMethod === "string"
							? body.paymentMethod
							: "Cash",
					date: body.date ? new Date(String(body.date)) : new Date(),
				},
			});
			return { statusCode: 201, success: true, data: tx };
		}

		const txMatch = pathname.match(/^\/finances\/transactions\/([^/]+)$/);
		if (txMatch && method === "DELETE") {
			const txId = txMatch[1];
			await prisma.transaction.delete({ where: { id: txId } });
			return { statusCode: 200, success: true, data: null };
		}

		// ================= TRACKERS ROUTES =================
		if (pathname === "/trackers" && method === "GET") {
			const todayStr = new Date().toISOString().slice(0, 10);
			const trackers = await prisma.dailyTracker.findMany({
				where: { userId, isArchived: false },
				include: {
					logs: {
						where: { date: todayStr },
					},
				},
				orderBy: { createdAt: "desc" },
			});
			return { statusCode: 200, success: true, data: trackers };
		}

		if (pathname === "/trackers" && method === "POST") {
			const tracker = await prisma.dailyTracker.create({
				data: {
					userId,
					name: String(body.name || "Tracker"),
					category:
						typeof body.category === "string" ? body.category : "Meals & Food",
					unitName: typeof body.unitName === "string" ? body.unitName : "meals",
					defaultTarget: Number(body.defaultTarget) || 2,
					unitPrice: body.unitPrice ? Number(body.unitPrice) : null,
					currency: typeof body.currency === "string" ? body.currency : "USD",
					description:
						typeof body.description === "string" ? body.description : null,
					color: typeof body.color === "string" ? body.color : "emerald",
				},
			});
			return { statusCode: 201, success: true, data: tracker };
		}

		const trackerLogMatch = pathname.match(/^\/trackers\/([^/]+)\/log$/);
		if (trackerLogMatch && method === "POST") {
			const trackerId = trackerLogMatch[1];
			const dateStr =
				typeof body.date === "string"
					? body.date
					: new Date().toISOString().slice(0, 10);

			const log = await prisma.dailyTrackerLog.upsert({
				where: {
					trackerId_date: {
						trackerId,
						date: dateStr,
					},
				},
				create: {
					trackerId,
					userId,
					date: dateStr,
					value: Number(body.value) || 0,
					status: typeof body.status === "string" ? body.status : "LOGGED",
					unitPrice: body.unitPrice ? Number(body.unitPrice) : null,
					notes: typeof body.notes === "string" ? body.notes : null,
				},
				update: {
					value: body.value !== undefined ? Number(body.value) : undefined,
					status: typeof body.status === "string" ? body.status : undefined,
					unitPrice:
						body.unitPrice !== undefined ? Number(body.unitPrice) : undefined,
					notes: typeof body.notes === "string" ? body.notes : undefined,
				},
			});
			return { statusCode: 200, success: true, data: log };
		}

		const trackerMatch = pathname.match(/^\/trackers\/([^/]+)$/);
		if (trackerMatch && method === "DELETE") {
			const trackerId = trackerMatch[1];
			await prisma.dailyTracker.delete({ where: { id: trackerId } });
			return { statusCode: 200, success: true, data: null };
		}

		// ================= CATEGORIES ROUTES =================
		if (pathname === "/categories" && method === "GET") {
			const where: Record<string, unknown> = { userId };
			if (query.group) where.group = query.group.toUpperCase();
			const categories = await prisma.categoryOption.findMany({
				where,
				orderBy: { name: "asc" },
			});
			return { statusCode: 200, success: true, data: categories };
		}

		if (pathname === "/categories" && method === "POST") {
			const category = await prisma.categoryOption.create({
				data: {
					userId,
					name: String(body.name || "Custom"),
					group: String(body.group || "EXPENSE").toUpperCase(),
					color: typeof body.color === "string" ? body.color : null,
				},
			});
			return { statusCode: 201, success: true, data: category };
		}

		const catMatch = pathname.match(/^\/categories\/([^/]+)$/);
		if (catMatch && method === "DELETE") {
			const catId = catMatch[1];
			await prisma.categoryOption.delete({ where: { id: catId } });
			return { statusCode: 200, success: true, data: null };
		}

		// ================= SYNC STUBS =================
		if (pathname.startsWith("/sync")) {
			return {
				statusCode: 200,
				success: true,
				data: {
					message: "Local-first standalone mode: sync bridge active",
					connected: false,
				},
			};
		}

		// Fallback for unhandled endpoints
		console.warn(`[IPC Dispatcher] Unhandled endpoint: ${method} ${pathname}`);
		return {
			statusCode: 404,
			success: false,
			message: `Endpoint ${pathname} not found in in-process dispatcher`,
			data: null,
		};
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(
			`[IPC Dispatcher Error] ${method} ${pathname} failed:`,
			message,
		);
		return {
			statusCode: 500,
			success: false,
			message,
			data: null,
		};
	}
}
