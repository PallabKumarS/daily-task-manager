import * as React from "react";

export function getTodayDateString(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function formatDateString(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "";
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function formatReadableDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatTime(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function getWeekRange(date = new Date()): { start: Date; end: Date } {
	const target = new Date(date);
	const day = target.getDay();
	const diff = target.getDate() - day + (day === 0 ? -6 : 1);
	const start = new Date(target.setDate(diff));
	start.setHours(0, 0, 0, 0);

	const end = new Date(start);
	end.setDate(start.getDate() + 6);
	end.setHours(23, 59, 59, 999);

	return { start, end };
}

export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
	const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
	const end = new Date(year, month, 0, 23, 59, 59, 999);
	return { start, end };
}

export function getYearRange(year: number): { start: Date; end: Date } {
	const start = new Date(year, 0, 1, 0, 0, 0, 0);
	const end = new Date(year, 11, 31, 23, 59, 59, 999);
	return { start, end };
}

export function calculateNewStreak(
	lastCompletedDate: string | null,
	today: string,
	currentStreak: number,
): number {
	if (!lastCompletedDate) {
		return 1;
	}
	if (lastCompletedDate === today) {
		return currentStreak;
	}

	const last = new Date(lastCompletedDate);
	const current = new Date(today);
	const diffTime = current.getTime() - last.getTime();
	const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

	if (diffDays === 1) {
		return currentStreak + 1;
	}
	return 1;
}

// Reactive zero-cost midnight rollover subscription
let cachedTodayStr = getTodayDateString();
let cachedReadable = formatReadableDate(new Date());
let cachedDate = new Date();

const dateSubscribers = new Set<() => void>();

function notifyDateSubscribers(): void {
	cachedTodayStr = getTodayDateString();
	cachedReadable = formatReadableDate(new Date());
	cachedDate = new Date();
	for (const sub of dateSubscribers) {
		sub();
	}
}

function checkDateRollover(): void {
	const currentStr = getTodayDateString();
	if (currentStr !== cachedTodayStr) {
		notifyDateSubscribers();
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("daypulse:date-changed", { detail: { date: currentStr } }),
			);
			window.dispatchEvent(new CustomEvent("daypulse:refresh"));
		}
	}
}

let rolloverTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextMinuteCheck(): void {
	if (typeof window === "undefined") return;
	if (rolloverTimer) clearTimeout(rolloverTimer);

	const now = new Date();
	const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;

	rolloverTimer = setTimeout(() => {
		checkDateRollover();
		scheduleNextMinuteCheck();
	}, msUntilNextMinute);
}

if (typeof window !== "undefined") {
	scheduleNextMinuteCheck();
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			checkDateRollover();
		}
	});
	window.addEventListener("focus", () => {
		checkDateRollover();
	});
}

export function useTodayDate(): {
	todayDateString: string;
	readableDate: string;
	now: Date;
} {
	const dateSnapshot = React.useSyncExternalStore(
		(callback) => {
			dateSubscribers.add(callback);
			return () => {
				dateSubscribers.delete(callback);
			};
		},
		() => cachedTodayStr,
		() => getTodayDateString(),
	);

	return React.useMemo(
		() => ({
			todayDateString: dateSnapshot,
			readableDate: cachedReadable,
			now: cachedDate,
		}),
		[dateSnapshot],
	);
}
