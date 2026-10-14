import type {
	DailyTrackerItem,
	TrackerDayDetail,
	TrackerDetailResponse,
	TrackerTodayLog,
} from "@/components/trackers/tracker-types";

export function formatTrackerWithMonthStats(
	tracker: Record<string, unknown>,
	allLogs: Array<Record<string, unknown>>,
	targetDate: string,
): DailyTrackerItem {
	const [yearStr, monthStr] = targetDate.split("-");
	const year = Number(yearStr) || new Date().getFullYear();
	const month = Number(monthStr) || new Date().getMonth() + 1;

	const lastDay = new Date(year, month, 0).getDate();
	const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
	const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

	const trackerLogs = allLogs.filter((l) => l.trackerId === tracker.id);
	const todayLogRaw = trackerLogs.find((l) => l.date === targetDate) || null;
	const monthLogs = trackerLogs.filter(
		(l) => typeof l.date === "string" && l.date >= monthStart && l.date <= monthEnd,
	);

	let totalUnitsMonth = 0;
	let totalCostMonth = 0;
	let unsettledUnits = 0;
	let unsettledCost = 0;
	let cancelledDays = 0;

	for (const log of monthLogs) {
		const val = Number(log.value) || 0;
		totalUnitsMonth += val;
		const rate =
			typeof log.unitPrice === "number"
				? log.unitPrice
				: typeof tracker.unitPrice === "number"
					? (tracker.unitPrice as number)
					: 0;
		const cost = val * rate;
		totalCostMonth += cost;

		if (!log.isSettled) {
			unsettledUnits += val;
			unsettledCost += cost;
		}

		if (log.status === "CANCELLED" || (val === 0 && log.notes)) {
			cancelledDays += 1;
		}
	}

	const todayLog: TrackerTodayLog | null = todayLogRaw
		? {
				id: String(todayLogRaw.id),
				date: String(todayLogRaw.date),
				value: Number(todayLogRaw.value) || 0,
				status: (todayLogRaw.status as "LOGGED" | "CANCELLED" | "SKIPPED") || "LOGGED",
				unitPrice: typeof todayLogRaw.unitPrice === "number" ? todayLogRaw.unitPrice : null,
				notes: todayLogRaw.notes ? String(todayLogRaw.notes) : null,
				isSettled: Boolean(todayLogRaw.isSettled),
				settledAt: todayLogRaw.settledAt ? String(todayLogRaw.settledAt) : null,
			}
		: null;

	return {
		id: String(tracker.id),
		userId: String(tracker.userId || "usr_local"),
		name: String(tracker.name || "Tracker"),
		category: String(tracker.category || "General"),
		unitName: String(tracker.unitName || "units"),
		defaultTarget: Number(tracker.defaultTarget) || 1,
		unitPrice: typeof tracker.unitPrice === "number" ? tracker.unitPrice : null,
		currency: String(tracker.currency || "USD"),
		description: tracker.description ? String(tracker.description) : null,
		color: tracker.color ? String(tracker.color) : "emerald",
		isArchived: Boolean(tracker.isArchived),
		createdAt: String(tracker.createdAt || new Date().toISOString()),
		updatedAt: String(tracker.updatedAt || new Date().toISOString()),
		todayLog,
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
			daysLoggedCount: monthLogs.length,
		},
	};
}

export function buildLocalTrackerMonthDetail(
	tracker: Record<string, unknown>,
	allLogs: Array<Record<string, unknown>>,
	year: number,
	month: number,
): TrackerDetailResponse {
	const monthStr = String(month).padStart(2, "0");
	const lastDay = new Date(year, month, 0).getDate();
	const startDate = `${year}-${monthStr}-01`;
	const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

	const trackerLogs = allLogs.filter(
		(l) =>
			l.trackerId === tracker.id &&
			typeof l.date === "string" &&
			l.date >= startDate &&
			l.date <= endDate,
	);
	trackerLogs.sort((a, b) => String(a.date).localeCompare(String(b.date)));

	const logMap = new Map<string, Record<string, unknown>>();
	for (const l of trackerLogs) {
		logMap.set(String(l.date), l);
	}

	const days: TrackerDayDetail[] = [];
	let totalUnits = 0;
	let totalCost = 0;
	let unsettledUnits = 0;
	let unsettledCost = 0;
	let settledCost = 0;
	let cancelledDaysCount = 0;
	let loggedDaysCount = 0;

	for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
		const dayStr = String(dayNum).padStart(2, "0");
		const dateKey = `${year}-${monthStr}-${dayStr}`;
		const existingLog = logMap.get(dateKey);

		if (existingLog) {
			loggedDaysCount += 1;
			const val = Number(existingLog.value) || 0;
			const rate =
				typeof existingLog.unitPrice === "number"
					? existingLog.unitPrice
					: typeof tracker.unitPrice === "number"
						? (tracker.unitPrice as number)
						: 0;
			const dayCost = val * rate;
			totalUnits += val;
			totalCost += dayCost;

			if (existingLog.isSettled) {
				settledCost += dayCost;
			} else {
				unsettledUnits += val;
				unsettledCost += dayCost;
			}

			if (existingLog.status === "CANCELLED" || (val === 0 && existingLog.notes)) {
				cancelledDaysCount += 1;
			}

			days.push({
				date: dateKey,
				dayNumber: dayNum,
				value: val,
				status: String(existingLog.status || "LOGGED"),
				unitPrice: rate,
				dayCost: Number(dayCost.toFixed(2)),
				notes: existingLog.notes ? String(existingLog.notes) : null,
				isSettled: Boolean(existingLog.isSettled),
				settledAt: existingLog.settledAt ? String(existingLog.settledAt) : null,
				logId: existingLog.id ? String(existingLog.id) : null,
			});
		} else {
			days.push({
				date: dateKey,
				dayNumber: dayNum,
				value: 0,
				status: "UNLOGGED",
				unitPrice: typeof tracker.unitPrice === "number" ? tracker.unitPrice : 0,
				dayCost: 0,
				notes: null,
				isSettled: false,
				settledAt: null,
				logId: null,
			});
		}
	}

	const formattedTracker = formatTrackerWithMonthStats(
		tracker,
		allLogs,
		new Date().toISOString().slice(0, 10),
	);

	return {
		tracker: formattedTracker,
		period: {
			year,
			month,
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
	};
}
