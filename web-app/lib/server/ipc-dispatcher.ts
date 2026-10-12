import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import JSZip from "jszip";
import { createBackupArchive } from "./archive-builder";
import {
	extractArchiveCollections,
	previewBackupArchive,
	restoreBackupArchive,
} from "./archive-extractor";
import {
	type BackupCollections,
	type BackupRecord,
	emptyCollections,
	mergeBackupIntoUser,
	summarizeMergeReport,
} from "./backup-merge";
import { handleCategoryRoute } from "./category-handlers";
import { handleDebtLoanRoute } from "./debt-loan-handlers";
import { calculateFinanceAnalytics } from "./finance-analytics";
import {
	clearLatestGoogleRestoreLoginResult,
	executeGoogleSyncRestore,
	executeGoogleSyncUpload,
	getGoogleAuthUrl,
	getLatestGoogleRestoreLoginResult,
	isGoogleConfigured,
	startGoogleOAuthLoopbackServer,
} from "./google-sync";
import { getCurrentUserId, getPrismaClient } from "./prisma-client";
import { endSession, startSession } from "./session-store";

export interface IpcApiRequest {
	endpoint: string;
	method?: string;
	body?: unknown;
	query?: Record<string, string>;
	token?: string | null;
}

export type ApiRequest = IpcApiRequest;

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

export type ServerApiResponse<T = unknown> = IpcApiResponse<T>;

export const handleApiDispatch = handleIpcApiDispatch;

export async function handleIpcApiDispatch(req: IpcApiRequest): Promise<IpcApiResponse> {
	const prisma = getPrismaClient();
	let userId = getCurrentUserId() || "";

	// Resolve user from token if passed
	if (req.token) {
		const tokenVal = req.token.trim();
		let potentialUserId = "";
		if (tokenVal.startsWith("daypulse_token_")) {
			potentialUserId = tokenVal.slice("daypulse_token_".length);
		} else if (tokenVal.length > 10 && !tokenVal.includes(" ")) {
			potentialUserId = tokenVal;
		}

		if (potentialUserId) {
			const matchedUser = await prisma.user.findUnique({
				where: { id: potentialUserId },
			});
			if (matchedUser) {
				userId = matchedUser.id;
			}
		}
	}

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
			if (!userId) {
				return {
					statusCode: 401,
					success: false,
					message: "Not authenticated",
					data: null,
				};
			}

			const user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) {
				return {
					statusCode: 401,
					success: false,
					message: "User not found",
					data: null,
				};
			}

			const { passwordHash: _, ...safeUser } = user;
			return {
				statusCode: 200,
				success: true,
				data: {
					...safeUser,
					createdAt: user.createdAt.toISOString(),
					updatedAt: user.updatedAt.toISOString(),
				},
			};
		}

		if (pathname === "/auth/me" && method === "PATCH") {
			if (!userId) {
				return {
					statusCode: 401,
					success: false,
					message: "Not authenticated",
					data: null,
				};
			}
			const updated = await prisma.user.update({
				where: { id: userId },
				data: {
					name: typeof body.name === "string" ? body.name : undefined,
					currency: typeof body.currency === "string" ? body.currency : undefined,
				},
			});
			return { statusCode: 200, success: true, data: updated };
		}

		if (pathname === "/auth/login" && method === "POST") {
			const email = String(body.email || "")
				.toLowerCase()
				.trim();
			const password = String(body.password || "");

			const user = await prisma.user.findUnique({ where: { email } });
			if (!user) {
				return {
					statusCode: 401,
					success: false,
					message: "Invalid email or password.",
					data: null,
				};
			}

			const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);
			if (!isPasswordMatched) {
				return {
					statusCode: 401,
					success: false,
					message: "Invalid email or password.",
					data: null,
				};
			}

			startSession(user.id);
			return {
				statusCode: 200,
				success: true,
				data: {
					user: {
						id: user.id,
						email: user.email,
						name: user.name,
						currency: user.currency,
						createdAt: user.createdAt.toISOString(),
					},
					token: `daypulse_token_${user.id}`,
				},
			};
		}

		if (pathname === "/auth/register" && method === "POST") {
			const email = String(body.email || "")
				.toLowerCase()
				.trim();
			const password = String(body.password || "");
			const name = String(body.name || "User");
			const currency = String(body.currency || "USD").toUpperCase();

			const existingUser = await prisma.user.findUnique({ where: { email } });
			if (existingUser) {
				return {
					statusCode: 409,
					success: false,
					message: "An account with this email address already exists.",
					data: null,
				};
			}

			const salt = await bcrypt.genSalt(10);
			const passwordHash = await bcrypt.hash(password, salt);

			const newUser = await prisma.user.create({
				data: {
					name,
					email,
					passwordHash,
					currency,
				},
			});

			startSession(newUser.id);
			return {
				statusCode: 201,
				success: true,
				data: {
					user: {
						id: newUser.id,
						email: newUser.email,
						name: newUser.name,
						currency: newUser.currency,
						createdAt: newUser.createdAt.toISOString(),
					},
					token: `daypulse_token_${newUser.id}`,
				},
			};
		}

		if (pathname === "/auth/logout" && method === "POST") {
			endSession();
			return {
				statusCode: 200,
				success: true,
				message: "Logged out successfully",
				data: null,
			};
		}

		// Pre-auth file-based backup restore (works from login / onboarding screen)
		if (pathname === "/auth/restore-backup" && method === "POST") {
			const archiveBase64 = String(body.archiveBase64 || body.archive || body.data || "");
			const backupPayload = (body.backup || body.data) as Record<string, unknown> | undefined;

			let targetEmail = "";
			let targetName = "Restored User";
			let targetCurrency = "USD";
			let collections: BackupCollections = emptyCollections();

			if (archiveBase64) {
				const clean = archiveBase64.replace(/^data:.*?;base64,/, "").trim();
				const buffer = Buffer.from(clean, "base64");
				const zip = await JSZip.loadAsync(buffer);
				const extracted = await extractArchiveCollections(zip);
				collections = extracted.collections;
				targetEmail = extracted.user?.email || extracted.manifest?.user?.email || "";
				targetName = extracted.user?.name || extracted.manifest?.user?.name || "Restored User";
				targetCurrency = extracted.user?.currency || extracted.manifest?.user?.currency || "USD";
			} else if (backupPayload && typeof backupPayload === "object") {
				const u = (backupPayload.user as Record<string, unknown>) || {};
				targetEmail = String(u.email || "");
				targetName = String(u.name || "Restored User");
				targetCurrency = String(u.currency || "USD");
				collections = {
					tasks: (backupPayload.tasks as BackupRecord[]) || [],
					routines: (backupPayload.routines as BackupRecord[]) || [],
					routineLogs: (backupPayload.routineLogs as BackupRecord[]) || [],
					transactions: (backupPayload.transactions as BackupRecord[]) || [],
					trackers: (backupPayload.trackers as BackupRecord[]) || [],
					trackerLogs: (backupPayload.trackerLogs as BackupRecord[]) || [],
					categories: (backupPayload.categories as BackupRecord[]) || [],
				};
			} else {
				return {
					statusCode: 400,
					success: false,
					message: "No backup data or archive provided",
					data: null,
				};
			}

			if (!targetEmail) {
				targetEmail = String(body.email || "local@daypulse.app");
			}

			let targetUser = await prisma.user.findUnique({
				where: { email: targetEmail },
			});
			if (!targetUser) {
				const salt = await bcrypt.genSalt(10);
				const rawPassword =
					typeof body.password === "string" && body.password ? body.password : crypto.randomUUID();
				const passwordHash = await bcrypt.hash(rawPassword, salt);
				targetUser = await prisma.user.create({
					data: {
						email: targetEmail,
						name: targetName,
						passwordHash,
						currency: targetCurrency,
					},
				});
			}

			const mergeReport = await mergeBackupIntoUser(prisma, targetUser.id, collections);
			startSession(targetUser.id);
			const summary = summarizeMergeReport(mergeReport);

			return {
				statusCode: 200,
				success: true,
				message: `Workspace restored successfully (${summary})`,
				data: {
					user: {
						id: targetUser.id,
						email: targetUser.email,
						name: targetUser.name,
						currency: targetUser.currency,
						createdAt: targetUser.createdAt.toISOString(),
					},
					token: `daypulse_token_${targetUser.id}`,
					summary,
				},
			};
		}

		if (pathname === "/auth/google/restore-url" && method === "GET") {
			if (!isGoogleConfigured()) {
				return {
					statusCode: 400,
					success: false,
					message:
						"Google Drive sync is not configured. Please define GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
					data: null,
				};
			}
			startGoogleOAuthLoopbackServer(prisma);
			clearLatestGoogleRestoreLoginResult();
			const url = getGoogleAuthUrl("restore_onboarding");
			return {
				statusCode: 200,
				success: true,
				data: { url },
			};
		}

		if (pathname === "/auth/google/restore-status" && method === "GET") {
			const result = getLatestGoogleRestoreLoginResult();
			if (result) {
				return {
					statusCode: 200,
					success: true,
					data: result,
				};
			}
			return {
				statusCode: 200,
				success: true,
				data: null,
			};
		}

		const toIsoString = (val: unknown): string | null => {
			if (!val) return null;
			if (val instanceof Date) return val.toISOString();
			return String(val);
		};

		const notFound = (entity: string): IpcApiResponse => ({
			statusCode: 404,
			success: false,
			message: `${entity} not found`,
			data: null,
		});

		const numberOr = (val: unknown, fallback: number): number => {
			if (val === undefined || val === null || val === "") return fallback;
			const parsed = Number(val);
			return Number.isFinite(parsed) ? parsed : fallback;
		};

		if (!userId && pathname !== "/sync/archive/preview") {
			return {
				statusCode: 401,
				success: false,
				message: "Authentication required. Please sign in or restore your account.",
				data: null,
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

			const formatted = tasks.map((t) => ({
				...t,
				startDate: toIsoString(t.startDate),
				dueDate: toIsoString(t.dueDate),
				repeatUntil: toIsoString(t.repeatUntil),
				completedAt: toIsoString(t.completedAt),
				createdAt: toIsoString(t.createdAt) || new Date().toISOString(),
				updatedAt: toIsoString(t.updatedAt) || new Date().toISOString(),
			}));

			return { statusCode: 200, success: true, data: formatted };
		}

		if (pathname === "/tasks" && method === "POST") {
			const task = await prisma.task.create({
				data: {
					userId,
					title: String(body.title || "Untitled Task"),
					description: typeof body.description === "string" ? body.description : null,
					type: typeof body.type === "string" ? body.type : "TASK",
					category: typeof body.category === "string" ? body.category : "General",
					priority: typeof body.priority === "string" ? body.priority : "MEDIUM",
					status: typeof body.status === "string" ? body.status : "PENDING",
					startDate: body.startDate ? new Date(String(body.startDate)) : null,
					dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
					remindBeforeMinutes: numberOr(body.remindBeforeMinutes, 15),
					isRecurring: Boolean(body.isRecurring),
					repeatFrequency: body.repeatFrequency ? String(body.repeatFrequency) : null,
					repeatInterval: Number(body.repeatInterval) || 1,
					repeatDaysOfWeek: body.repeatDaysOfWeek ? String(body.repeatDaysOfWeek) : null,
					repeatTime: body.repeatTime ? String(body.repeatTime) : null,
					repeatDayOfMonth: body.repeatDayOfMonth ? Number(body.repeatDayOfMonth) : null,
					repeatMonthOfYear: body.repeatMonthOfYear ? Number(body.repeatMonthOfYear) : null,
					repeatEndType: body.repeatEndType ? String(body.repeatEndType) : null,
					repeatCount: body.repeatCount ? Number(body.repeatCount) : null,
					repeatUntil: body.repeatUntil ? new Date(String(body.repeatUntil)) : null,
				},
			});

			return {
				statusCode: 201,
				success: true,
				data: {
					...task,
					startDate: toIsoString(task.startDate),
					dueDate: toIsoString(task.dueDate),
					repeatUntil: toIsoString(task.repeatUntil),
					completedAt: toIsoString(task.completedAt),
					createdAt: toIsoString(task.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(task.updatedAt) || new Date().toISOString(),
				},
			};
		}

		const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
		if (taskMatch && method === "GET") {
			const taskId = taskMatch[1];
			const task = await prisma.task.findFirst({
				where: { id: taskId, userId },
			});
			if (!task) {
				return notFound("Task not found");
			}
			return {
				statusCode: 200,
				success: true,
				data: {
					...task,
					startDate: toIsoString(task.startDate),
					dueDate: toIsoString(task.dueDate),
					repeatUntil: toIsoString(task.repeatUntil),
					completedAt: toIsoString(task.completedAt),
					createdAt: toIsoString(task.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(task.updatedAt) || new Date().toISOString(),
				},
			};
		}

		if (taskMatch && method === "PATCH") {
			const taskId = taskMatch[1];
			const updated = await prisma.task.update({
				where: { id: taskId },
				data: {
					title: typeof body.title === "string" ? body.title : undefined,
					description: typeof body.description === "string" ? body.description : undefined,
					status: typeof body.status === "string" ? body.status : undefined,
					priority: typeof body.priority === "string" ? body.priority : undefined,
					category: typeof body.category === "string" ? body.category : undefined,
					type: typeof body.type === "string" ? body.type : undefined,
					startDate: body.startDate ? new Date(String(body.startDate)) : undefined,
					dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
					completedAt: body.status === "COMPLETED" ? new Date() : body.status ? null : undefined,
					remindBeforeMinutes:
						body.remindBeforeMinutes !== undefined ? Number(body.remindBeforeMinutes) : undefined,
					isRecurring: body.isRecurring !== undefined ? Boolean(body.isRecurring) : undefined,
					repeatFrequency:
						body.repeatFrequency !== undefined
							? body.repeatFrequency
								? String(body.repeatFrequency)
								: null
							: undefined,
					repeatInterval:
						body.repeatInterval !== undefined ? Number(body.repeatInterval) : undefined,
					repeatDaysOfWeek:
						body.repeatDaysOfWeek !== undefined
							? body.repeatDaysOfWeek
								? String(body.repeatDaysOfWeek)
								: null
							: undefined,
					repeatTime:
						body.repeatTime !== undefined
							? body.repeatTime
								? String(body.repeatTime)
								: null
							: undefined,
					repeatDayOfMonth:
						body.repeatDayOfMonth !== undefined
							? body.repeatDayOfMonth
								? Number(body.repeatDayOfMonth)
								: null
							: undefined,
					repeatMonthOfYear:
						body.repeatMonthOfYear !== undefined
							? body.repeatMonthOfYear
								? Number(body.repeatMonthOfYear)
								: null
							: undefined,
					repeatEndType:
						body.repeatEndType !== undefined
							? body.repeatEndType
								? String(body.repeatEndType)
								: null
							: undefined,
					repeatCount:
						body.repeatCount !== undefined
							? body.repeatCount
								? Number(body.repeatCount)
								: null
							: undefined,
					repeatUntil:
						body.repeatUntil !== undefined
							? body.repeatUntil
								? new Date(String(body.repeatUntil))
								: null
							: undefined,
					lastCompletedDate:
						body.lastCompletedDate !== undefined
							? body.lastCompletedDate
								? String(body.lastCompletedDate)
								: null
							: undefined,
					lastTriggeredDate:
						body.lastTriggeredDate !== undefined
							? body.lastTriggeredDate
								? String(body.lastTriggeredDate)
								: null
							: undefined,
					completedOccurrences:
						body.completedOccurrences !== undefined ? Number(body.completedOccurrences) : undefined,
				},
			});

			return {
				statusCode: 200,
				success: true,
				data: {
					...updated,
					startDate: toIsoString(updated.startDate),
					dueDate: toIsoString(updated.dueDate),
					repeatUntil: toIsoString(updated.repeatUntil),
					completedAt: toIsoString(updated.completedAt),
					createdAt: toIsoString(updated.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(updated.updatedAt) || new Date().toISOString(),
				},
			};
		}

		if (pathname === "/tasks" && method === "DELETE") {
			await prisma.task.deleteMany({ where: { userId } });
			return {
				statusCode: 200,
				success: true,
				message: "All tasks deleted",
				data: null,
			};
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
				createdAt: toIsoString(r.createdAt) || new Date().toISOString(),
				updatedAt: toIsoString(r.updatedAt) || new Date().toISOString(),
				isCompletedToday: r.logs.length > 0 && r.logs[0].completed,
			}));

			return { statusCode: 200, success: true, data: formatted };
		}

		if (pathname === "/routines" && method === "POST") {
			const routine = await prisma.routine.create({
				data: {
					userId,
					title: String(body.title || "Routine"),
					description: typeof body.description === "string" ? body.description : null,
					timeSlot: typeof body.timeSlot === "string" ? body.timeSlot : "morning",
					targetTime: typeof body.targetTime === "string" ? body.targetTime : null,
					daysOfWeek: typeof body.daysOfWeek === "string" ? body.daysOfWeek : "0,1,2,3,4,5,6",
					reminderMinutes: Number(body.reminderMinutes) || 0,
				},
			});
			return {
				statusCode: 201,
				success: true,
				data: {
					...routine,
					createdAt: toIsoString(routine.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(routine.updatedAt) || new Date().toISOString(),
				},
			};
		}

		const routineToggleMatch = pathname.match(/^\/routines\/([^/]+)\/toggle$/);
		if (routineToggleMatch && method === "POST") {
			const routineId = routineToggleMatch[1];
			const todayStr =
				typeof body.date === "string" ? body.date : new Date().toISOString().slice(0, 10);

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
						lastCompletedDate: isNowCompleted ? todayStr : routine.lastCompletedDate,
					},
				});
			}

			return {
				statusCode: 200,
				success: true,
				data: { routineId, completed: isNowCompleted, date: todayStr },
			};
		}

		if (pathname === "/routines" && method === "DELETE") {
			await prisma.routineLog.deleteMany({ where: { userId } });
			await prisma.routine.deleteMany({ where: { userId } });
			return {
				statusCode: 200,
				success: true,
				message: "All routines deleted",
				data: null,
			};
		}

		const routineMatch = pathname.match(/^\/routines\/([^/]+)$/);
		if (routineMatch && method === "GET") {
			const routineId = routineMatch[1];
			const routine = await prisma.routine.findFirst({
				where: { id: routineId, userId },
				include: {
					logs: {
						orderBy: { date: "desc" },
						take: 30,
					},
				},
			});
			if (!routine) {
				return notFound("Routine not found");
			}
			const todayStr = new Date().toISOString().slice(0, 10);
			const isCompletedToday = routine.logs.some((l) => l.date === todayStr && l.completed);
			return {
				statusCode: 200,
				success: true,
				data: {
					...routine,
					createdAt: toIsoString(routine.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(routine.updatedAt) || new Date().toISOString(),
					isCompletedToday,
				},
			};
		}

		if (routineMatch && method === "PATCH") {
			const routineId = routineMatch[1];
			const updated = await prisma.routine.update({
				where: { id: routineId },
				data: {
					title: typeof body.title === "string" ? body.title : undefined,
					description: typeof body.description === "string" ? body.description : undefined,
					timeSlot: typeof body.timeSlot === "string" ? body.timeSlot : undefined,
					targetTime: typeof body.targetTime === "string" ? body.targetTime : undefined,
					daysOfWeek: typeof body.daysOfWeek === "string" ? body.daysOfWeek : undefined,
					reminderMinutes:
						body.reminderMinutes !== undefined ? Number(body.reminderMinutes) : undefined,
					streakCount: body.streakCount !== undefined ? Number(body.streakCount) : undefined,
					lastCompletedDate:
						body.lastCompletedDate !== undefined
							? body.lastCompletedDate
								? String(body.lastCompletedDate)
								: null
							: undefined,
				},
			});
			return {
				statusCode: 200,
				success: true,
				data: {
					...updated,
					createdAt: toIsoString(updated.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(updated.updatedAt) || new Date().toISOString(),
				},
			};
		}

		if (routineMatch && method === "DELETE") {
			const routineId = routineMatch[1];
			await prisma.routineLog.deleteMany({ where: { routineId } });
			await prisma.routine.delete({ where: { id: routineId } });
			return { statusCode: 200, success: true, data: null };
		}

		// ================= FINANCES ROUTES =================
		if (pathname === "/finances/analytics" && method === "GET") {
			const analytics = await calculateFinanceAnalytics(
				prisma,
				userId,
				query.period || "month",
				query.date,
			);
			return { statusCode: 200, success: true, data: analytics };
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
					categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
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

		if ((pathname === "/finances/transactions" || pathname === "/finances") && method === "GET") {
			const where: Record<string, unknown> = { userId };
			if (query.type && ["EXPENSE", "INCOME"].includes(query.type.toUpperCase())) {
				where.type = query.type.toUpperCase();
			}
			if (query.category) {
				where.category = query.category;
			}
			if (query.startDate || query.endDate) {
				const dateFilter: Record<string, Date> = {};
				if (query.startDate) dateFilter.gte = new Date(query.startDate);
				if (query.endDate) dateFilter.lte = new Date(query.endDate);
				where.date = dateFilter;
			}

			const limit = query.limit ? Number(query.limit) : undefined;
			const transactions = await prisma.transaction.findMany({
				where,
				orderBy: { date: "desc" },
				...(limit ? { take: limit } : {}),
			});

			const formatted = transactions.map((t) => ({
				...t,
				date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
				createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
				updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt),
			}));

			return { statusCode: 200, success: true, data: formatted };
		}

		if ((pathname === "/finances/transactions" || pathname === "/finances") && method === "POST") {
			const tx = await prisma.transaction.create({
				data: {
					userId,
					type: String(body.type || "EXPENSE").toUpperCase(),
					amount: Number(body.amount) || 0,
					category: String(body.category || "General"),
					description: typeof body.description === "string" ? body.description : null,
					paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : "Cash",
					date: body.date ? new Date(String(body.date)) : new Date(),
				},
			});

			return {
				statusCode: 201,
				success: true,
				message: `${tx.type === "INCOME" ? "Income" : "Expense"} recorded`,
				data: {
					...tx,
					date: tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
					createdAt:
						tx.createdAt instanceof Date ? tx.createdAt.toISOString() : String(tx.createdAt),
					updatedAt:
						tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : String(tx.updatedAt),
				},
			};
		}

		if (
			(pathname === "/finances" || pathname === "/finances/transactions") &&
			method === "DELETE"
		) {
			await prisma.transaction.deleteMany({ where: { userId } });
			return {
				statusCode: 200,
				success: true,
				message: "All transactions deleted",
				data: null,
			};
		}

		const txSingleMatch = pathname.match(/^\/finances(?:\/transactions)?\/([^/]+)$/);
		if (
			txSingleMatch &&
			txSingleMatch[1] !== "analytics" &&
			txSingleMatch[1] !== "summary" &&
			txSingleMatch[1] !== "transactions"
		) {
			const txId = txSingleMatch[1];

			if (method === "GET") {
				const tx = await prisma.transaction.findFirst({
					where: { id: txId, userId },
				});
				if (!tx) {
					return {
						statusCode: 404,
						success: false,
						message: "Transaction not found",
						data: null,
					};
				}
				return {
					statusCode: 200,
					success: true,
					data: {
						...tx,
						date: tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
						createdAt:
							tx.createdAt instanceof Date ? tx.createdAt.toISOString() : String(tx.createdAt),
						updatedAt:
							tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : String(tx.updatedAt),
					},
				};
			}

			if (method === "PATCH") {
				const existing = await prisma.transaction.findFirst({
					where: { id: txId, userId },
				});
				if (!existing) {
					return {
						statusCode: 404,
						success: false,
						message: "Transaction not found",
						data: null,
					};
				}

				const updateData: Record<string, unknown> = {};
				if (typeof body.type === "string") {
					updateData.type = body.type.toUpperCase();
				}
				if (body.amount !== undefined) {
					updateData.amount = Number(body.amount);
				}
				if (typeof body.category === "string") {
					updateData.category = body.category;
				}
				if (body.description !== undefined) {
					updateData.description = typeof body.description === "string" ? body.description : null;
				}
				if (typeof body.paymentMethod === "string") {
					updateData.paymentMethod = body.paymentMethod;
				}
				if (body.date) {
					updateData.date = new Date(String(body.date));
				}

				const updated = await prisma.transaction.update({
					where: { id: txId },
					data: updateData,
				});

				return {
					statusCode: 200,
					success: true,
					message: "Transaction updated",
					data: {
						...updated,
						date: updated.date instanceof Date ? updated.date.toISOString() : String(updated.date),
						createdAt:
							updated.createdAt instanceof Date
								? updated.createdAt.toISOString()
								: String(updated.createdAt),
						updatedAt:
							updated.updatedAt instanceof Date
								? updated.updatedAt.toISOString()
								: String(updated.updatedAt),
					},
				};
			}

			if (method === "DELETE") {
				const existing = await prisma.transaction.findFirst({
					where: { id: txId, userId },
				});
				if (!existing) {
					return {
						statusCode: 404,
						success: false,
						message: "Transaction not found",
						data: null,
					};
				}

				await prisma.transaction.delete({ where: { id: txId } });
				return {
					statusCode: 200,
					success: true,
					message: "Transaction deleted",
					data: null,
				};
			}
		}

		// ================= TRACKERS ROUTES =================
		if (pathname === "/trackers" && method === "GET") {
			const targetDate = query.date || new Date().toISOString().slice(0, 10);
			const [yearStr, monthStr] = targetDate.split("-");
			const year = Number(yearStr) || new Date().getFullYear();
			const month = Number(monthStr) || new Date().getMonth() + 1;

			const lastDay = new Date(year, month, 0).getDate();
			const monthStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
			const monthEndDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

			const trackers = await prisma.dailyTracker.findMany({
				where: { userId, isArchived: false },
				include: {
					logs: {
						where: {
							date: {
								gte: monthStartDate,
								lte: monthEndDate,
							},
						},
					},
				},
				orderBy: { createdAt: "asc" },
			});

			const formatted = trackers.map((tracker) => {
				const todayLog = tracker.logs.find((l) => l.date === targetDate) || null;

				let totalUnitsMonth = 0;
				let totalCostMonth = 0;
				let unsettledUnits = 0;
				let unsettledCost = 0;
				let cancelledDays = 0;

				for (const log of tracker.logs) {
					totalUnitsMonth += log.value;
					const rate = log.unitPrice ?? tracker.unitPrice ?? 0;
					const cost = log.value * rate;
					totalCostMonth += cost;

					if (!log.isSettled) {
						unsettledUnits += log.value;
						unsettledCost += cost;
					}

					if (log.status === "CANCELLED" || (log.value === 0 && log.notes)) {
						cancelledDays += 1;
					}
				}

				return {
					...tracker,
					createdAt: toIsoString(tracker.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(tracker.updatedAt) || new Date().toISOString(),
					todayLog: todayLog
						? {
								id: todayLog.id,
								date: todayLog.date,
								value: todayLog.value,
								status: todayLog.status,
								unitPrice: todayLog.unitPrice,
								notes: todayLog.notes,
								isSettled: todayLog.isSettled,
								settledAt: toIsoString(todayLog.settledAt),
							}
						: null,
					todayValue: todayLog ? todayLog.value : 0,
					isLoggedToday: Boolean(todayLog),
					monthStats: {
						year,
						month,
						totalUnits: totalUnitsMonth,
						totalCost: Number(totalCostMonth.toFixed(2)),
						unsettledUnits,
						unsettledCost: Number(unsettledCost.toFixed(2)),
						cancelledDays,
						daysLoggedCount: tracker.logs.length,
					},
				};
			});

			return { statusCode: 200, success: true, data: formatted };
		}

		if (pathname === "/trackers" && method === "POST") {
			const tracker = await prisma.dailyTracker.create({
				data: {
					userId,
					name: String(body.name || "Tracker"),
					category: typeof body.category === "string" ? body.category : "Meals & Food",
					unitName: typeof body.unitName === "string" ? body.unitName : "meals",
					defaultTarget: Number(body.defaultTarget) || 2,
					unitPrice: body.unitPrice ? Number(body.unitPrice) : null,
					currency: typeof body.currency === "string" ? body.currency : "USD",
					description: typeof body.description === "string" ? body.description : null,
					color: typeof body.color === "string" ? body.color : "emerald",
				},
			});
			return {
				statusCode: 201,
				success: true,
				data: {
					...tracker,
					createdAt: toIsoString(tracker.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(tracker.updatedAt) || new Date().toISOString(),
				},
			};
		}

		const trackerLogMatch = pathname.match(/^\/trackers\/([^/]+)\/logs?$/);
		if (trackerLogMatch && method === "GET") {
			const trackerId = trackerLogMatch[1];
			const logs = await prisma.dailyTrackerLog.findMany({
				where: { trackerId, userId },
				orderBy: { date: "desc" },
			});
			return { statusCode: 200, success: true, data: logs };
		}

		if (trackerLogMatch && method === "POST") {
			const trackerId = trackerLogMatch[1];
			const dateStr =
				typeof body.date === "string" ? body.date : new Date().toISOString().slice(0, 10);

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
					unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : undefined,
					notes: typeof body.notes === "string" ? body.notes : undefined,
				},
			});
			return { statusCode: 200, success: true, data: log };
		}

		const trackerSingleLogMatch = pathname.match(/^\/trackers\/([^/]+)\/logs?\/([^/]+)$/);
		if (trackerSingleLogMatch && method === "PATCH") {
			const logId = trackerSingleLogMatch[2];
			const updated = await prisma.dailyTrackerLog.update({
				where: { id: logId },
				data: {
					value: body.value !== undefined ? Number(body.value) : undefined,
					status: typeof body.status === "string" ? body.status : undefined,
					unitPrice: body.unitPrice !== undefined ? Number(body.unitPrice) : undefined,
					notes: typeof body.notes === "string" ? body.notes : undefined,
					isSettled: body.isSettled !== undefined ? Boolean(body.isSettled) : undefined,
				},
			});
			return { statusCode: 200, success: true, data: updated };
		}

		if (trackerSingleLogMatch && method === "DELETE") {
			const logId = trackerSingleLogMatch[2];
			await prisma.dailyTrackerLog.delete({ where: { id: logId } });
			return { statusCode: 200, success: true, data: null };
		}

		const trackerSettleMatch = pathname.match(/^\/trackers\/([^/]+)\/settle$/);
		if (trackerSettleMatch && method === "POST") {
			const trackerId = trackerSettleMatch[1];
			const tracker = await prisma.dailyTracker.findFirst({
				where: { id: trackerId, userId },
			});
			if (!tracker) {
				return {
					statusCode: 404,
					success: false,
					message: "Tracker not found",
					data: null,
				};
			}

			const startDate = String(body.startDate || "");
			const endDate = String(body.endDate || "");

			const unsettledLogs = await prisma.dailyTrackerLog.findMany({
				where: {
					trackerId,
					userId,
					date: { gte: startDate, lte: endDate },
					isSettled: false,
					value: { gt: 0 },
				},
			});

			if (unsettledLogs.length === 0) {
				return {
					statusCode: 400,
					success: false,
					message: "No unsettled items found for the selected period.",
					data: null,
				};
			}

			let totalAmount = 0;
			let totalUnits = 0;
			for (const log of unsettledLogs) {
				const rate = log.unitPrice ?? tracker.unitPrice ?? 0;
				totalAmount += log.value * rate;
				totalUnits += log.value;
			}
			totalAmount = Number(totalAmount.toFixed(2));

			const settlementDescription =
				typeof body.notes === "string" && body.notes
					? body.notes
					: `Settlement: ${tracker.name} (${totalUnits} ${tracker.unitName}, ${startDate} to ${endDate})`;

			const [transaction] = await prisma.$transaction([
				prisma.transaction.create({
					data: {
						userId,
						type: "EXPENSE",
						amount: totalAmount,
						category:
							typeof body.category === "string"
								? body.category
								: tracker.category || "Meals & Food",
						description: settlementDescription,
						paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : "Cash",
						date: new Date(),
					},
				}),
				prisma.dailyTrackerLog.updateMany({
					where: { id: { in: unsettledLogs.map((l) => l.id) } },
					data: { isSettled: true, settledAt: new Date() },
				}),
			]);

			return {
				statusCode: 200,
				success: true,
				message: "Tracker settlement recorded in finances.",
				data: {
					transaction,
					settledLogsCount: unsettledLogs.length,
					totalAmount,
				},
			};
		}

		const trackerMatch = pathname.match(/^\/trackers\/([^/]+)$/);
		if (trackerMatch && method === "GET") {
			const trackerId = trackerMatch[1];
			const tracker = await prisma.dailyTracker.findFirst({
				where: { id: trackerId, userId },
			});

			if (!tracker) {
				return {
					statusCode: 404,
					success: false,
					message: "Tracker not found",
					data: null,
				};
			}

			const now = new Date();
			const targetYear = query.year ? Number(query.year) : now.getFullYear();
			const targetMonth = query.month ? Number(query.month) : now.getMonth() + 1;

			const monthStr = String(targetMonth).padStart(2, "0");
			const lastDay = new Date(targetYear, targetMonth, 0).getDate();
			const startDate = `${targetYear}-${monthStr}-01`;
			const endDate = `${targetYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

			const logs = await prisma.dailyTrackerLog.findMany({
				where: {
					trackerId,
					userId,
					date: { gte: startDate, lte: endDate },
				},
				orderBy: { date: "asc" },
			});

			const logMap = new Map<string, (typeof logs)[0]>();
			for (const log of logs) {
				logMap.set(log.date, log);
			}

			const days = [];
			let totalUnits = 0;
			let totalCost = 0;
			let unsettledUnits = 0;
			let unsettledCost = 0;
			let settledCost = 0;
			let cancelledDaysCount = 0;
			let loggedDaysCount = 0;

			for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
				const dayStr = String(dayNum).padStart(2, "0");
				const dateKey = `${targetYear}-${monthStr}-${dayStr}`;
				const existingLog = logMap.get(dateKey);

				if (existingLog) {
					loggedDaysCount += 1;
					const rate = existingLog.unitPrice ?? tracker.unitPrice ?? 0;
					const dayCost = existingLog.value * rate;
					totalUnits += existingLog.value;
					totalCost += dayCost;

					if (existingLog.isSettled) {
						settledCost += dayCost;
					} else {
						unsettledUnits += existingLog.value;
						unsettledCost += dayCost;
					}

					if (
						existingLog.status === "CANCELLED" ||
						(existingLog.value === 0 && existingLog.notes)
					) {
						cancelledDaysCount += 1;
					}

					days.push({
						date: dateKey,
						dayNumber: dayNum,
						value: existingLog.value,
						status: existingLog.status,
						unitPrice: rate,
						dayCost: Number(dayCost.toFixed(2)),
						notes: existingLog.notes,
						isSettled: existingLog.isSettled,
						settledAt: existingLog.settledAt,
						logId: existingLog.id,
					});
				} else {
					days.push({
						date: dateKey,
						dayNumber: dayNum,
						value: 0,
						status: "UNLOGGED",
						unitPrice: tracker.unitPrice ?? 0,
						dayCost: 0,
						notes: null,
						isSettled: false,
						settledAt: null,
						logId: null,
					});
				}
			}

			return {
				statusCode: 200,
				success: true,
				data: {
					tracker,
					period: {
						year: targetYear,
						month: targetMonth,
						daysInMonth: lastDay,
						startDate,
						endDate,
					},
					stats: {
						totalUnits,
						totalCost: Number(totalCost.toFixed(2)),
						unsettledUnits,
						unsettledCost: Number(unsettledCost.toFixed(2)),
						settledCost: Number(settledCost.toFixed(2)),
						cancelledDaysCount,
						loggedDaysCount,
					},
					days,
					logs,
				},
			};
		}

		if (trackerMatch && method === "PATCH") {
			const trackerId = trackerMatch[1];
			const updated = await prisma.dailyTracker.update({
				where: { id: trackerId },
				data: {
					name: typeof body.name === "string" ? body.name : undefined,
					category: typeof body.category === "string" ? body.category : undefined,
					unitName: typeof body.unitName === "string" ? body.unitName : undefined,
					defaultTarget: body.defaultTarget !== undefined ? Number(body.defaultTarget) : undefined,
					unitPrice:
						body.unitPrice !== undefined
							? body.unitPrice
								? Number(body.unitPrice)
								: null
							: undefined,
					currency: typeof body.currency === "string" ? body.currency : undefined,
					description: typeof body.description === "string" ? body.description : undefined,
					color: typeof body.color === "string" ? body.color : undefined,
				},
			});
			return {
				statusCode: 200,
				success: true,
				data: {
					...updated,
					createdAt: toIsoString(updated.createdAt) || new Date().toISOString(),
					updatedAt: toIsoString(updated.updatedAt) || new Date().toISOString(),
				},
			};
		}

		if (pathname === "/trackers" && method === "DELETE") {
			await prisma.dailyTrackerLog.deleteMany({ where: { userId } });
			await prisma.dailyTracker.deleteMany({ where: { userId } });
			return {
				statusCode: 200,
				success: true,
				message: "All trackers deleted",
				data: null,
			};
		}

		if (trackerMatch && method === "DELETE") {
			const trackerId = trackerMatch[1];
			await prisma.dailyTrackerLog.deleteMany({ where: { trackerId } });
			await prisma.dailyTracker.delete({ where: { id: trackerId } });
			return { statusCode: 200, success: true, data: null };
		}

		// ================= CATEGORIES ROUTES =================
		if (pathname === "/categories" || pathname.startsWith("/categories/")) {
			const categoryResult = await handleCategoryRoute(
				prisma,
				userId,
				method,
				pathname,
				query,
				body,
			);
			if (categoryResult) return categoryResult;
		}

		// ================= DEBTS & LOANS ROUTES =================
		if (pathname === "/debts-loans" || pathname.startsWith("/debts-loans/")) {
			const debtLoanResult = await handleDebtLoanRoute(
				prisma,
				userId,
				method,
				pathname,
				query,
				body,
			);
			if (debtLoanResult) return debtLoanResult;
		}

		// ================= SYNC & BACKUP ROUTES =================
		if (pathname === "/sync/export" && method === "POST") {
			const currentUser = await prisma.user.findUnique({
				where: { id: userId },
			});
			const tasks = await prisma.task.findMany({ where: { userId } });
			const routines = await prisma.routine.findMany({ where: { userId } });
			const routineLogs = await prisma.routineLog.findMany({
				where: { userId },
			});
			const transactions = await prisma.transaction.findMany({
				where: { userId },
			});
			const trackers = await prisma.dailyTracker.findMany({
				where: { userId },
			});
			const trackerLogs = await prisma.dailyTrackerLog.findMany({
				where: { userId },
			});
			const categories = await prisma.categoryOption.findMany({
				where: { userId },
			});

			const backupBundle = {
				version: 1,
				exportedAt: new Date().toISOString(),
				user: currentUser
					? {
							id: currentUser.id,
							name: currentUser.name,
							email: currentUser.email,
							currency: currentUser.currency,
						}
					: null,
				tasks,
				routines,
				routineLogs,
				transactions,
				trackers,
				trackerLogs,
				categories,
			};

			return {
				statusCode: 200,
				success: true,
				data: backupBundle,
			};
		}

		if (
			(pathname === "/sync/restore" || pathname === "/sync/google/restore") &&
			method === "POST"
		) {
			const backup = body as {
				version?: number;
				user?: {
					id?: string;
					name?: string;
					email?: string;
					currency?: string;
				};
				tasks?: Array<Record<string, unknown>>;
				routines?: Array<Record<string, unknown>>;
				routineLogs?: Array<Record<string, unknown>>;
				transactions?: Array<Record<string, unknown>>;
				trackers?: Array<Record<string, unknown>>;
				trackerLogs?: Array<Record<string, unknown>>;
				categories?: Array<Record<string, unknown>>;
			};

			const hasBackupPayload =
				backup &&
				typeof backup === "object" &&
				(Array.isArray(backup.tasks) ||
					Array.isArray(backup.routines) ||
					Array.isArray(backup.transactions) ||
					Array.isArray(backup.trackers) ||
					Array.isArray(backup.categories));

			if (!hasBackupPayload || pathname === "/sync/google/restore") {
				try {
					const result = await executeGoogleSyncRestore(prisma, userId);
					return {
						statusCode: 200,
						success: true,
						message: result.message,
						data: null,
					};
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					const isAuth =
						msg.includes("expired") ||
						msg.includes("401") ||
						msg.includes("reconnect") ||
						msg.includes("invalid_client") ||
						msg.includes("invalid_grant");
					return {
						statusCode: isAuth ? 401 : 500,
						success: false,
						message: isAuth
							? "Google Drive session has expired. Please reconnect your Google account in Settings."
							: msg,
						data: null,
					};
				}
			}

			if (!backup || typeof backup !== "object") {
				return {
					statusCode: 400,
					success: false,
					message: "Invalid backup bundle format",
					data: null,
				};
			}

			const mergeReport = await mergeBackupIntoUser(prisma, userId, {
				tasks: backup.tasks || [],
				routines: backup.routines || [],
				routineLogs: backup.routineLogs || [],
				transactions: backup.transactions || [],
				trackers: backup.trackers || [],
				trackerLogs: backup.trackerLogs || [],
				categories: backup.categories || [],
			});
			const summary = summarizeMergeReport(mergeReport);

			return {
				statusCode: 200,
				success: true,
				message: summary
					? `Backup restored successfully (${summary})`
					: "Backup bundle successfully restored into local database",
				data: {
					restoredAt: new Date().toISOString(),
					summary,
					mergeReport,
				},
			};
		}

		// ================= MULTI-COLLECTION ZIP ARCHIVE ROUTES =================
		if (
			(pathname === "/sync/archive/export" || pathname === "/sync/export-archive") &&
			(method === "POST" || method === "GET")
		) {
			const archiveResult = await createBackupArchive(userId, prisma);
			return {
				statusCode: 200,
				success: true,
				message: "Backup ZIP archive created successfully",
				data: {
					fileName: archiveResult.fileName,
					manifest: archiveResult.manifest,
					base64: archiveResult.base64,
				},
			};
		}

		if (pathname === "/sync/archive/preview" && method === "POST") {
			const archiveBase64 = String(body.archiveBase64 || body.archive || body.data || "");
			if (!archiveBase64) {
				return {
					statusCode: 400,
					success: false,
					message: "No archive payload provided for preview",
					data: null,
				};
			}

			const preview = await previewBackupArchive(archiveBase64);
			return {
				statusCode: preview.valid ? 200 : 400,
				success: preview.valid,
				message: preview.error || "Archive metadata loaded",
				data: preview,
			};
		}

		if (
			(pathname === "/sync/archive/restore" || pathname === "/sync/restore-archive") &&
			method === "POST"
		) {
			const archiveBase64 = String(body.archiveBase64 || body.archive || body.data || "");
			if (!archiveBase64) {
				return {
					statusCode: 400,
					success: false,
					message: "No archive payload provided for restore",
					data: null,
				};
			}

			const restoreResult = await restoreBackupArchive(archiveBase64, userId, prisma);
			return {
				statusCode: 200,
				success: true,
				message: restoreResult.summary
					? `Archive restored successfully: ${restoreResult.summary}`
					: "Archive successfully unpacked and restored into local database",
				data: restoreResult,
			};
		}

		if (pathname === "/sync/simulate" && method === "POST") {
			const action = String(body.action || "").toLowerCase();
			if (action === "export") {
				const archiveResult = await createBackupArchive(userId, prisma);
				return {
					statusCode: 200,
					success: true,
					data: {
						fileName: archiveResult.fileName,
						manifest: archiveResult.manifest,
						archiveBase64: archiveResult.base64,
						backup: archiveResult.manifest,
					},
				};
			}
			if (action === "import") {
				const importData = body.data;
				if (typeof importData === "string") {
					// Could be base64 zip archive
					const restoreResult = await restoreBackupArchive(importData, userId, prisma);
					return {
						statusCode: 200,
						success: true,
						message: "Data restored from backup archive",
						data: restoreResult,
					};
				}
			}
		}

		// ================= SYNC & GOOGLE CLOUD ROUTES =================
		if (pathname === "/sync/status" && method === "GET") {
			const [conn, taskCount, routineCount, txCount, trackerCount] = await Promise.all([
				prisma.googleConnection.findUnique({ where: { userId } }),
				prisma.task.count({ where: { userId } }),
				prisma.routine.count({ where: { userId } }),
				prisma.transaction.count({ where: { userId } }),
				prisma.dailyTracker.count({ where: { userId } }),
			]);
			const configured = isGoogleConfigured();
			return {
				statusCode: 200,
				success: true,
				data: {
					isConfigured: configured,
					configured,
					isConnected: Boolean(conn),
					connected: Boolean(conn),
					email: conn?.googleEmail || null,
					googleEmail: conn?.googleEmail || null,
					lastSyncAt: conn?.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
					lastGoogleSyncAt: conn?.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
					driveFileId: conn?.driveFileId || null,
					userId,
					stats: {
						tasks: taskCount,
						routines: routineCount,
						transactions: txCount,
						trackers: trackerCount,
					},
				},
			};
		}

		if (pathname === "/sync/auth-url" && method === "GET") {
			if (!isGoogleConfigured()) {
				return {
					statusCode: 400,
					success: false,
					message:
						"Google Drive sync is not configured. Please define GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
					data: null,
				};
			}
			startGoogleOAuthLoopbackServer(prisma);
			const url = getGoogleAuthUrl(userId);
			return {
				statusCode: 200,
				success: true,
				data: { url, authUrl: url },
			};
		}

		if (pathname === "/sync/upload" && method === "POST") {
			try {
				const result = await executeGoogleSyncUpload(prisma, userId);
				return {
					statusCode: 200,
					success: true,
					message: result.message,
					data: { lastSyncAt: result.lastSyncAt },
				};
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				const isAuth =
					msg.includes("expired") ||
					msg.includes("401") ||
					msg.includes("reconnect") ||
					msg.includes("invalid_client") ||
					msg.includes("invalid_grant");
				return {
					statusCode: isAuth ? 401 : 500,
					success: false,
					message: isAuth
						? "Google Drive session has expired. Please reconnect your Google account in Settings."
						: msg,
					data: null,
				};
			}
		}

		if (pathname === "/sync/disconnect" && method === "POST") {
			await prisma.googleConnection.deleteMany({ where: { userId } });
			return {
				statusCode: 200,
				success: true,
				message: "Google account disconnected successfully",
				data: null,
			};
		}

		if (pathname === "/sync/simulate" && method === "POST") {
			const now = new Date();
			await prisma.googleConnection.updateMany({
				where: { userId },
				data: { lastSyncAt: now },
			});
			return {
				statusCode: 200,
				success: true,
				message: "Sync simulated successfully",
				data: { lastSyncAt: now.toISOString() },
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
		console.error(`[IPC Dispatcher Error] ${method} ${pathname} failed:`, message);
		return {
			statusCode: 500,
			success: false,
			message,
			data: null,
		};
	}
}
