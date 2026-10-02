export interface TrackerTodayLog {
	id: string;
	date: string;
	value: number;
	status: "LOGGED" | "CANCELLED" | "SKIPPED";
	unitPrice?: number | null;
	notes?: string | null;
	isSettled: boolean;
	settledAt?: string | null;
}

export interface TrackerMonthStats {
	year: number;
	month: number;
	totalUnits: number;
	totalCost: number;
	unsettledUnits: number;
	unsettledCost: number;
	cancelledDays: number;
	daysLoggedCount: number;
}

export interface DailyTrackerItem {
	id: string;
	userId: string;
	name: string;
	category: string;
	unitName: string;
	defaultTarget: number;
	unitPrice?: number | null;
	currency: string;
	description?: string | null;
	color?: string;
	isArchived: boolean;
	createdAt: string;
	updatedAt: string;
	todayLog: TrackerTodayLog | null;
	todayValue: number;
	isLoggedToday: boolean;
	monthStats: TrackerMonthStats;
}

export interface TrackerDayDetail {
	date: string;
	dayNumber: number;
	value: number;
	status: string;
	unitPrice: number;
	dayCost: number;
	notes: string | null;
	isSettled: boolean;
	settledAt: string | null;
	logId: string | null;
}

export interface TrackerDetailResponse {
	tracker: DailyTrackerItem;
	period: {
		year: number;
		month: number;
		daysInMonth: number;
		startDate: string;
		endDate: string;
	};
	stats: {
		totalUnits: number;
		totalCost: number;
		unsettledUnits: number;
		unsettledCost: number;
		settledCost: number;
		cancelledDaysCount: number;
		loggedDaysCount: number;
	};
	days: TrackerDayDetail[];
}
