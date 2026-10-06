import { AppError } from "../../errors/AppError.js";
import { decryptToken, encryptToken } from "../../utils/cryptoVault.js";
import {
	downloadBackupFromGoogleDrive,
	exchangeCodeForTokens,
	getGoogleAuthUrl,
	getGoogleProfile,
	isGoogleConfigured,
	listGoogleDriveBackups,
	refreshGoogleAccessToken,
	revokeGoogleToken,
	uploadBackupToGoogleDrive,
} from "../../utils/googleDrive.js";
import { prisma } from "../../utils/prisma.js";
import { broadcastSyncUpdate } from "../socket/socket.service.js";
import type { IDayPulseBackup, ISyncStatus } from "./sync.interface.js";

async function getValidAccessToken(userId: string): Promise<string> {
	const connection = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	if (!connection) {
		throw new AppError(400, "Google Drive is not connected for this account.");
	}

	const now = new Date();
	const expiry = connection.tokenExpiry ? new Date(connection.tokenExpiry) : null;
	const isExpiringSoon = expiry ? expiry.getTime() - now.getTime() < 5 * 60 * 1000 : false;

	if (isExpiringSoon && connection.encryptedRefresh) {
		try {
			const refreshToken = decryptToken(connection.encryptedRefresh);
			const refreshed = await refreshGoogleAccessToken(refreshToken);

			const encryptedAccess = encryptToken(refreshed.accessToken);
			const tokenExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);

			await prisma.googleConnection.update({
				where: { userId },
				data: { encryptedAccess, tokenExpiry },
			});

			return refreshed.accessToken;
		} catch {
			// Fallback to existing token if refresh call fails
			return decryptToken(connection.encryptedAccess);
		}
	}

	return decryptToken(connection.encryptedAccess);
}

export const getSyncStatusFromDB = async (userId: string): Promise<ISyncStatus> => {
	const connection = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	const isConnected = Boolean(connection);
	const isConfigured = isGoogleConfigured();

	return {
		isConfigured,
		isConnected,
		configured: isConfigured,
		connected: isConnected,
		email: connection?.googleEmail || null,
		googleEmail: connection?.googleEmail || null,
		lastSyncAt: connection?.lastSyncAt || null,
		lastGoogleSyncAt: connection?.lastSyncAt || null,
		driveFileId: connection?.driveFileId || null,
	};
};

export const getGoogleOAuthUrl = (userId: string): { url: string } => {
	if (!isGoogleConfigured()) {
		throw new AppError(
			400,
			"Google OAuth is not configured on the server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
		);
	}

	const url = getGoogleAuthUrl(userId);
	return { url };
};

export const connectGoogleInDB = async (userId: string, code: string) => {
	const tokens = await exchangeCodeForTokens(code);
	const profile = await getGoogleProfile(tokens.accessToken);

	const encryptedAccess = encryptToken(tokens.accessToken);
	const encryptedRefresh = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;
	const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

	const connection = await prisma.googleConnection.upsert({
		where: { userId },
		update: {
			googleId: profile.id,
			googleEmail: profile.email,
			encryptedAccess,
			...(encryptedRefresh ? { encryptedRefresh } : {}),
			tokenExpiry,
		},
		create: {
			userId,
			googleId: profile.id,
			googleEmail: profile.email,
			encryptedAccess,
			encryptedRefresh,
			tokenExpiry,
		},
	});

	broadcastSyncUpdate(userId, "sync", "connected", {
		email: connection.googleEmail,
		lastSyncAt: connection.lastSyncAt,
	});

	return {
		isConnected: true,
		connected: true,
		email: connection.googleEmail,
		googleEmail: connection.googleEmail,
		lastSyncAt: connection.lastSyncAt,
		lastGoogleSyncAt: connection.lastSyncAt,
	};
};

export const uploadToDriveFromDB = async (userId: string) => {
	const connection = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	if (!connection) {
		throw new AppError(400, "Google Drive is not connected. Please connect Google Drive first.");
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			routines: true,
			routineLogs: true,
			tasks: true,
			transactions: true,
			dailyTrackers: true,
			dailyTrackerLogs: true,
		},
	});

	if (!user) {
		throw new AppError(404, "User not found.");
	}

	const accessToken = await getValidAccessToken(userId);

	const backupData: IDayPulseBackup = {
		version: 1,
		exportedAt: new Date().toISOString(),
		source: "DayPulse Express Server",
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			currency: user.currency,
		},
		data: {
			routines: user.routines.map((r) => ({
				id: r.id,
				title: r.title,
				description: r.description,
				timeSlot: r.timeSlot,
				targetTime: r.targetTime,
				daysOfWeek: r.daysOfWeek,
				streakCount: r.streakCount,
				lastCompletedDate: r.lastCompletedDate,
				reminderMinutes: r.reminderMinutes,
				createdAt: r.createdAt.toISOString(),
				updatedAt: r.updatedAt.toISOString(),
			})),
			routineLogs: user.routineLogs.map((l) => ({
				id: l.id,
				routineId: l.routineId,
				date: l.date,
				completed: l.completed,
				completedAt: l.completedAt.toISOString(),
			})),
			tasks: user.tasks.map((t) => ({
				id: t.id,
				title: t.title,
				description: t.description,
				type: t.type,
				category: t.category,
				priority: t.priority,
				status: t.status,
				startDate: t.startDate ? t.startDate.toISOString() : null,
				dueDate: t.dueDate ? t.dueDate.toISOString() : null,
				remindBeforeMinutes: t.remindBeforeMinutes,
				reminderSent: t.reminderSent,
				completedAt: t.completedAt ? t.completedAt.toISOString() : null,
				createdAt: t.createdAt.toISOString(),
				updatedAt: t.updatedAt.toISOString(),
			})),
			transactions: user.transactions.map((tr) => ({
				id: tr.id,
				type: tr.type,
				amount: tr.amount,
				category: tr.category,
				description: tr.description,
				paymentMethod: tr.paymentMethod,
				date: tr.date.toISOString(),
				createdAt: tr.createdAt.toISOString(),
				updatedAt: tr.updatedAt.toISOString(),
			})),
			dailyTrackers: user.dailyTrackers.map((dt) => ({
				id: dt.id,
				name: dt.name,
				category: dt.category,
				unitName: dt.unitName,
				defaultTarget: dt.defaultTarget,
				unitPrice: dt.unitPrice,
				currency: dt.currency,
				description: dt.description,
				color: dt.color,
				isArchived: dt.isArchived,
				createdAt: dt.createdAt.toISOString(),
				updatedAt: dt.updatedAt.toISOString(),
			})),
			dailyTrackerLogs: user.dailyTrackerLogs.map((dtl) => ({
				id: dtl.id,
				trackerId: dtl.trackerId,
				date: dtl.date,
				value: dtl.value,
				status: dtl.status,
				unitPrice: dtl.unitPrice,
				notes: dtl.notes,
				isSettled: dtl.isSettled,
				settledAt: dtl.settledAt ? dtl.settledAt.toISOString() : null,
				settlementTransactionId: dtl.settlementTransactionId,
				createdAt: dtl.createdAt.toISOString(),
				updatedAt: dtl.updatedAt.toISOString(),
			})),
		},
	};

	const uploadResult = await uploadBackupToGoogleDrive(
		accessToken,
		backupData,
		"DayPulse_Backup.json",
		connection.driveFileId,
	);

	const now = new Date();
	await prisma.googleConnection.update({
		where: { userId },
		data: {
			driveFileId: uploadResult.id,
			lastSyncAt: now,
		},
	});

	broadcastSyncUpdate(userId, "sync", "upload", {
		fileId: uploadResult.id,
		lastSyncAt: now,
	});

	return {
		success: true,
		fileId: uploadResult.id,
		fileName: uploadResult.name,
		lastSyncAt: now,
	};
};

export const listDriveBackupsFromDB = async (userId: string) => {
	const accessToken = await getValidAccessToken(userId);
	return listGoogleDriveBackups(accessToken);
};

export const restoreFromDriveInDB = async (userId: string, fileId?: string) => {
	const connection = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	if (!connection) {
		throw new AppError(400, "Google Drive is not connected.");
	}

	const targetId = fileId || connection.driveFileId;
	if (!targetId) {
		throw new AppError(404, "No backup file found in Google Drive to restore.");
	}

	const accessToken = await getValidAccessToken(userId);
	const downloaded = (await downloadBackupFromGoogleDrive(
		accessToken,
		targetId,
	)) as IDayPulseBackup;

	if (!downloaded?.data) {
		throw new AppError(400, "Invalid backup file structure found in Google Drive.");
	}

	const {
		routines = [],
		routineLogs = [],
		tasks = [],
		transactions = [],
		dailyTrackers = [],
		dailyTrackerLogs = [],
	} = downloaded.data;

	// Idempotent upserting: never duplicates existing entries
	for (const r of routines) {
		if (!r?.id) continue;
		await prisma.routine.upsert({
			where: { id: r.id },
			update: {
				title: r.title,
				description: r.description,
				timeSlot: r.timeSlot,
				targetTime: r.targetTime,
				daysOfWeek: r.daysOfWeek,
				streakCount: r.streakCount,
				lastCompletedDate: r.lastCompletedDate,
				reminderMinutes: r.reminderMinutes,
			},
			create: {
				id: r.id,
				userId,
				title: r.title,
				description: r.description,
				timeSlot: r.timeSlot,
				targetTime: r.targetTime,
				daysOfWeek: r.daysOfWeek,
				streakCount: r.streakCount,
				lastCompletedDate: r.lastCompletedDate,
				reminderMinutes: r.reminderMinutes,
			},
		});
	}

	for (const l of routineLogs) {
		// Only upsert log if routine exists
		const routineExists = await prisma.routine.findUnique({ where: { id: l.routineId } });
		if (routineExists) {
			await prisma.routineLog.upsert({
				where: {
					routineId_date: {
						routineId: l.routineId,
						date: l.date,
					},
				},
				update: {
					completed: l.completed,
					completedAt: new Date(l.completedAt),
				},
				create: {
					id: l.id,
					routineId: l.routineId,
					userId,
					date: l.date,
					completed: l.completed,
					completedAt: new Date(l.completedAt),
				},
			});
		}
	}

	for (const t of tasks) {
		if (!t?.id) continue;
		await prisma.task.upsert({
			where: { id: t.id },
			update: {
				title: t.title,
				description: t.description,
				type: t.type,
				category: t.category,
				priority: t.priority,
				status: t.status,
				startDate: t.startDate ? new Date(t.startDate) : null,
				dueDate: t.dueDate ? new Date(t.dueDate) : null,
				remindBeforeMinutes: t.remindBeforeMinutes,
				reminderSent: t.reminderSent,
				completedAt: t.completedAt ? new Date(t.completedAt) : null,
			},
			create: {
				id: t.id,
				userId,
				title: t.title,
				description: t.description,
				type: t.type,
				category: t.category,
				priority: t.priority,
				status: t.status,
				startDate: t.startDate ? new Date(t.startDate) : null,
				dueDate: t.dueDate ? new Date(t.dueDate) : null,
				remindBeforeMinutes: t.remindBeforeMinutes,
				reminderSent: t.reminderSent,
				completedAt: t.completedAt ? new Date(t.completedAt) : null,
			},
		});
	}

	for (const tr of transactions) {
		if (!tr?.id) continue;
		await prisma.transaction.upsert({
			where: { id: tr.id },
			update: {
				type: tr.type,
				amount: tr.amount,
				category: tr.category,
				description: tr.description,
				paymentMethod: tr.paymentMethod,
				date: new Date(tr.date),
			},
			create: {
				id: tr.id,
				userId,
				type: tr.type,
				amount: tr.amount,
				category: tr.category,
				description: tr.description,
				paymentMethod: tr.paymentMethod,
				date: new Date(tr.date),
			},
		});
	}

	for (const dt of dailyTrackers) {
		if (!dt?.id) continue;
		await prisma.dailyTracker.upsert({
			where: { id: dt.id },
			update: {
				name: dt.name,
				category: dt.category,
				unitName: dt.unitName,
				defaultTarget: dt.defaultTarget,
				unitPrice: dt.unitPrice,
				currency: dt.currency,
				description: dt.description,
				color: dt.color,
				isArchived: dt.isArchived,
			},
			create: {
				id: dt.id,
				userId,
				name: dt.name,
				category: dt.category,
				unitName: dt.unitName,
				defaultTarget: dt.defaultTarget,
				unitPrice: dt.unitPrice,
				currency: dt.currency,
				description: dt.description,
				color: dt.color,
				isArchived: dt.isArchived,
			},
		});
	}

	for (const dtl of dailyTrackerLogs) {
		if (!dtl?.id) continue;
		const trackerExists = await prisma.dailyTracker.findUnique({ where: { id: dtl.trackerId } });
		if (trackerExists) {
			await prisma.dailyTrackerLog.upsert({
				where: {
					trackerId_date: {
						trackerId: dtl.trackerId,
						date: dtl.date,
					},
				},
				update: {
					value: dtl.value,
					status: dtl.status,
					unitPrice: dtl.unitPrice,
					notes: dtl.notes,
					isSettled: dtl.isSettled,
					settledAt: dtl.settledAt ? new Date(dtl.settledAt) : null,
					settlementTransactionId: dtl.settlementTransactionId,
				},
				create: {
					id: dtl.id,
					trackerId: dtl.trackerId,
					userId,
					date: dtl.date,
					value: dtl.value,
					status: dtl.status,
					unitPrice: dtl.unitPrice,
					notes: dtl.notes,
					isSettled: dtl.isSettled,
					settledAt: dtl.settledAt ? new Date(dtl.settledAt) : null,
					settlementTransactionId: dtl.settlementTransactionId,
				},
			});
		}
	}

	broadcastSyncUpdate(userId, "sync", "restore", { restoredAt: new Date() });

	return {
		success: true,
		restoredCounts: {
			routines: routines.length,
			routineLogs: routineLogs.length,
			tasks: tasks.length,
			transactions: transactions.length,
			dailyTrackers: dailyTrackers.length,
			dailyTrackerLogs: dailyTrackerLogs.length,
		},
	};
};

export const disconnectGoogleInDB = async (userId: string) => {
	const connection = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	if (connection) {
		try {
			const accessToken = decryptToken(connection.encryptedAccess);
			await revokeGoogleToken(accessToken);
		} catch {
			// ignore token revocation network issues
		}

		await prisma.googleConnection.delete({ where: { userId } });
	}

	broadcastSyncUpdate(userId, "sync", "disconnected", {});

	return {
		isConnected: false,
		message: "Google Drive disconnected successfully.",
	};
};

export const simulateSyncInDB = async (
	userId: string,
	action: "export" | "import",
	mockData?: IDayPulseBackup,
) => {
	if (action === "export") {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: { routines: true, routineLogs: true, tasks: true, transactions: true },
		});

		if (!user) throw new AppError(404, "User not found.");

		const backupData: IDayPulseBackup = {
			version: 1,
			exportedAt: new Date().toISOString(),
			source: "DayPulse Local Simulation",
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				currency: user.currency,
			},
			data: {
				routines: user.routines.map((r) => ({
					...r,
					createdAt: r.createdAt.toISOString(),
					updatedAt: r.updatedAt.toISOString(),
				})),
				routineLogs: user.routineLogs.map((l) => ({
					...l,
					completedAt: l.completedAt.toISOString(),
				})),
				tasks: user.tasks.map((t) => ({
					...t,
					startDate: t.startDate ? t.startDate.toISOString() : null,
					dueDate: t.dueDate ? t.dueDate.toISOString() : null,
					completedAt: t.completedAt ? t.completedAt.toISOString() : null,
					createdAt: t.createdAt.toISOString(),
					updatedAt: t.updatedAt.toISOString(),
				})),
				transactions: user.transactions.map((tr) => ({
					...tr,
					date: tr.date.toISOString(),
					createdAt: tr.createdAt.toISOString(),
					updatedAt: tr.updatedAt.toISOString(),
				})),
			},
		};

		broadcastSyncUpdate(userId, "sync", "upload", { simulated: true, lastSyncAt: new Date() });
		return { success: true, backup: backupData };
	}

	if (action === "import" && mockData?.data) {
		const { routines = [], tasks = [], transactions = [] } = mockData.data;

		for (const r of routines) {
			if (!r?.id) continue;
			await prisma.routine.upsert({
				where: { id: r.id },
				update: {
					title: r.title,
					description: r.description,
					timeSlot: r.timeSlot,
					targetTime: r.targetTime,
					daysOfWeek: r.daysOfWeek,
				},
				create: {
					id: r.id,
					userId,
					title: r.title,
					description: r.description,
					timeSlot: r.timeSlot,
					targetTime: r.targetTime,
					daysOfWeek: r.daysOfWeek,
				},
			});
		}

		for (const t of tasks) {
			if (!t?.id) continue;
			await prisma.task.upsert({
				where: { id: t.id },
				update: {
					title: t.title,
					description: t.description,
					status: t.status,
					priority: t.priority,
					category: t.category,
				},
				create: {
					id: t.id,
					userId,
					title: t.title,
					description: t.description,
					status: t.status,
					priority: t.priority,
					category: t.category,
				},
			});
		}

		for (const tr of transactions) {
			if (!tr?.id) continue;
			await prisma.transaction.upsert({
				where: { id: tr.id },
				update: {
					type: tr.type,
					amount: tr.amount,
					category: tr.category,
					description: tr.description,
					paymentMethod: tr.paymentMethod,
					date: new Date(tr.date),
				},
				create: {
					id: tr.id,
					userId,
					type: tr.type,
					amount: tr.amount,
					category: tr.category,
					description: tr.description,
					paymentMethod: tr.paymentMethod,
					date: new Date(tr.date),
				},
			});
		}

		broadcastSyncUpdate(userId, "sync", "restore", { simulated: true, restoredAt: new Date() });
		return {
			success: true,
			restored: {
				routines: routines.length,
				tasks: tasks.length,
				transactions: transactions.length,
			},
		};
	}

	throw new AppError(400, "Invalid simulation action or data.");
};
