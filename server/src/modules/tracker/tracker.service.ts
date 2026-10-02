import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../utils/prisma.js";
import { broadcastSyncUpdate } from "../socket/socket.service.js";
import type {
	ICreateTracker,
	ILogDailyTracker,
	ISettleTracker,
	IUpdateTracker,
} from "./tracker.interface.js";

const getTodayDateString = (): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export const getTrackersFromDB = async (
	userId: string,
	targetDate = getTodayDateString(),
) => {
	const [yearStr, monthStr] = targetDate.split("-");
	const year = Number(yearStr);
	const month = Number(monthStr);

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

	return trackers.map((tracker) => {
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
			id: tracker.id,
			userId: tracker.userId,
			name: tracker.name,
			category: tracker.category,
			unitName: tracker.unitName,
			defaultTarget: tracker.defaultTarget,
			unitPrice: tracker.unitPrice,
			currency: tracker.currency,
			description: tracker.description,
			color: tracker.color,
			isArchived: tracker.isArchived,
			createdAt: tracker.createdAt,
			updatedAt: tracker.updatedAt,
			todayLog: todayLog
				? {
						id: todayLog.id,
						date: todayLog.date,
						value: todayLog.value,
						status: todayLog.status,
						unitPrice: todayLog.unitPrice,
						notes: todayLog.notes,
						isSettled: todayLog.isSettled,
						settledAt: todayLog.settledAt,
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
};

export const getTrackerDetailsFromDB = async (
	userId: string,
	trackerId: string,
	year?: number,
	month?: number,
) => {
	const tracker = await prisma.dailyTracker.findFirst({
		where: { id: trackerId, userId },
	});

	if (!tracker) {
		throw new AppError(404, "Tracker not found.");
	}

	const now = new Date();
	const targetYear = year || now.getFullYear();
	const targetMonth = month || now.getMonth() + 1;

	const monthStr = String(targetMonth).padStart(2, "0");
	const lastDay = new Date(targetYear, targetMonth, 0).getDate();
	const startDate = `${targetYear}-${monthStr}-01`;
	const endDate = `${targetYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

	const logs = await prisma.dailyTrackerLog.findMany({
		where: {
			trackerId,
			userId,
			date: {
				gte: startDate,
				lte: endDate,
			},
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
	};
};

export const createTrackerInDB = async (
	userId: string,
	payload: ICreateTracker,
) => {
	const tracker = await prisma.dailyTracker.create({
		data: {
			userId,
			name: payload.name,
			category: payload.category || "Meals & Food",
			unitName: payload.unitName || "meals",
			defaultTarget: payload.defaultTarget ?? 2,
			unitPrice: payload.unitPrice !== undefined ? payload.unitPrice : null,
			currency: payload.currency || "USD",
			description: payload.description || null,
			color: payload.color || "emerald",
		},
	});

	broadcastSyncUpdate(userId, "tracker", "create", tracker);
	return tracker;
};

export const updateTrackerInDB = async (
	userId: string,
	trackerId: string,
	payload: IUpdateTracker,
) => {
	const existing = await prisma.dailyTracker.findFirst({
		where: { id: trackerId, userId },
	});

	if (!existing) {
		throw new AppError(404, "Tracker not found.");
	}

	const updated = await prisma.dailyTracker.update({
		where: { id: trackerId },
		data: {
			name: payload.name,
			category: payload.category,
			unitName: payload.unitName,
			defaultTarget: payload.defaultTarget,
			unitPrice: payload.unitPrice,
			currency: payload.currency,
			description: payload.description,
			color: payload.color,
			isArchived: payload.isArchived,
		},
	});

	broadcastSyncUpdate(userId, "tracker", "update", updated);
	return updated;
};

export const deleteTrackerInDB = async (userId: string, trackerId: string) => {
	const existing = await prisma.dailyTracker.findFirst({
		where: { id: trackerId, userId },
	});

	if (!existing) {
		throw new AppError(404, "Tracker not found.");
	}

	await prisma.dailyTracker.delete({
		where: { id: trackerId },
	});

	broadcastSyncUpdate(userId, "tracker", "delete", { id: trackerId });
	return null;
};

export const logTrackerDayInDB = async (
	userId: string,
	trackerId: string,
	payload: ILogDailyTracker,
) => {
	const tracker = await prisma.dailyTracker.findFirst({
		where: { id: trackerId, userId },
	});

	if (!tracker) {
		throw new AppError(404, "Tracker not found.");
	}

	const logUnitPrice =
		payload.unitPrice !== undefined ? payload.unitPrice : tracker.unitPrice;

	const log = await prisma.dailyTrackerLog.upsert({
		where: {
			trackerId_date: {
				trackerId,
				date: payload.date,
			},
		},
		create: {
			trackerId,
			userId,
			date: payload.date,
			value: payload.value,
			status: payload.status || "LOGGED",
			notes: payload.notes || null,
			unitPrice: logUnitPrice,
		},
		update: {
			value: payload.value,
			status: payload.status || "LOGGED",
			notes: payload.notes !== undefined ? payload.notes : undefined,
			unitPrice: logUnitPrice,
		},
	});

	broadcastSyncUpdate(userId, "tracker", "update", { trackerId, log });
	return log;
};

export const settleTrackerInDB = async (
	userId: string,
	trackerId: string,
	payload: ISettleTracker,
) => {
	const tracker = await prisma.dailyTracker.findFirst({
		where: { id: trackerId, userId },
	});

	if (!tracker) {
		throw new AppError(404, "Tracker not found.");
	}

	const unsettledLogs = await prisma.dailyTrackerLog.findMany({
		where: {
			trackerId,
			userId,
			date: {
				gte: payload.startDate,
				lte: payload.endDate,
			},
			isSettled: false,
			value: { gt: 0 },
		},
	});

	if (unsettledLogs.length === 0) {
		throw new AppError(
			400,
			"No unsettled items found for the selected period.",
		);
	}

	let totalAmount = 0;
	let totalUnits = 0;

	for (const log of unsettledLogs) {
		const rate = log.unitPrice ?? tracker.unitPrice ?? 0;
		totalAmount += log.value * rate;
		totalUnits += log.value;
	}

	totalAmount = Number(totalAmount.toFixed(2));

	if (totalAmount <= 0) {
		throw new AppError(
			400,
			"Total settlement amount is 0. No payment required.",
		);
	}

	const settlementDescription =
		payload.notes ||
		`Settlement: ${tracker.name} (${totalUnits} ${tracker.unitName}, ${payload.startDate} to ${payload.endDate})`;

	const [transaction] = await prisma.$transaction([
		prisma.transaction.create({
			data: {
				userId,
				type: "EXPENSE",
				amount: totalAmount,
				category: payload.category || tracker.category || "Meals & Food",
				description: settlementDescription,
				paymentMethod: payload.paymentMethod || "Cash",
				date: new Date(),
			},
		}),
		prisma.dailyTrackerLog.updateMany({
			where: {
				id: { in: unsettledLogs.map((l) => l.id) },
			},
			data: {
				isSettled: true,
				settledAt: new Date(),
			},
		}),
	]);

	broadcastSyncUpdate(userId, "tracker", "update", {
		trackerId,
		settledCount: unsettledLogs.length,
	});
	broadcastSyncUpdate(userId, "transaction", "create", transaction);

	return {
		transaction,
		settledLogsCount: unsettledLogs.length,
		totalUnits,
		totalAmount,
	};
};
