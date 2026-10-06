import * as React from "react";

export type StartOfWeekDay = 0 | 1 | 6; // Sunday | Monday | Saturday

export interface WorkweekPreferences {
	startOfWeek: StartOfWeekDay;
	weekendDays: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
	autoDailySync: boolean;
}

export const DEFAULT_WORKWEEK_PREFERENCES: WorkweekPreferences = {
	startOfWeek: 0, // Default: Sunday
	weekendDays: [5, 6], // Default: Friday and Saturday
	autoDailySync: true,
};

const STORAGE_KEY = "daypulse_workweek_preferences";

export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_NAMES_FULL = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

export function getStoredWorkweekPreferences(): WorkweekPreferences {
	if (typeof window === "undefined") {
		return DEFAULT_WORKWEEK_PREFERENCES;
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return {
				startOfWeek:
					parsed.startOfWeek === 1 || parsed.startOfWeek === 6 || parsed.startOfWeek === 0
						? parsed.startOfWeek
						: DEFAULT_WORKWEEK_PREFERENCES.startOfWeek,
				weekendDays: Array.isArray(parsed.weekendDays)
					? parsed.weekendDays
					: DEFAULT_WORKWEEK_PREFERENCES.weekendDays,
				autoDailySync:
					typeof parsed.autoDailySync === "boolean"
						? parsed.autoDailySync
						: DEFAULT_WORKWEEK_PREFERENCES.autoDailySync,
			};
		}
	} catch {
		// Ignore storage parse issues
	}

	return DEFAULT_WORKWEEK_PREFERENCES;
}

export function saveStoredWorkweekPreferences(prefs: WorkweekPreferences): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
		window.dispatchEvent(new CustomEvent("daypulse:preferences-updated", { detail: prefs }));
	} catch {
		// Ignore storage errors
	}
}

export function getStartOfWeek(date: Date, startDay: StartOfWeekDay = 0): Date {
	const result = new Date(date);
	result.setHours(0, 0, 0, 0);
	const currentDay = result.getDay();
	const diff = (currentDay < startDay ? 7 : 0) + currentDay - startDay;
	result.setDate(result.getDate() - diff);
	return result;
}

export function getEndOfWeek(date: Date, startDay: StartOfWeekDay = 0): Date {
	const start = getStartOfWeek(date, startDay);
	const end = new Date(start);
	end.setDate(end.getDate() + 6);
	end.setHours(23, 59, 59, 999);
	return end;
}

export function getPeriodDateRange(
	date: Date,
	period: "week" | "month" | "year",
	startDay: StartOfWeekDay = 0,
): { startDate: Date; endDate: Date } {
	if (period === "week") {
		return {
			startDate: getStartOfWeek(date, startDay),
			endDate: getEndOfWeek(date, startDay),
		};
	}

	if (period === "year") {
		const startDate = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
		const endDate = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
		return { startDate, endDate };
	}

	// Month
	const startDate = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
	const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
	return { startDate, endDate };
}

export function useWorkweekPreferences() {
	const [preferences, setPreferences] = React.useState<WorkweekPreferences>(
		DEFAULT_WORKWEEK_PREFERENCES,
	);

	React.useEffect(() => {
		setPreferences(getStoredWorkweekPreferences());

		const handleUpdate = () => {
			setPreferences(getStoredWorkweekPreferences());
		};

		window.addEventListener("daypulse:preferences-updated", handleUpdate);
		return () => {
			window.removeEventListener("daypulse:preferences-updated", handleUpdate);
		};
	}, []);

	const updatePreferences = React.useCallback((patch: Partial<WorkweekPreferences>) => {
		setPreferences((prev) => {
			const updated = { ...prev, ...patch };
			saveStoredWorkweekPreferences(updated);
			return updated;
		});
	}, []);

	const weekdays = React.useMemo(() => {
		const all = [0, 1, 2, 3, 4, 5, 6];
		return all.filter((d) => !preferences.weekendDays.includes(d));
	}, [preferences.weekendDays]);

	const weekendDays = preferences.weekendDays;

	return {
		preferences,
		updatePreferences,
		weekdays,
		weekendDays,
		startOfWeek: preferences.startOfWeek,
		autoDailySync: preferences.autoDailySync,
	};
}
