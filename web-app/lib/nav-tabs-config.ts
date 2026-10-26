import {
	Calculator,
	CalendarCheck,
	CheckSquare,
	LayoutDashboard,
	type LucideIcon,
	TrendingUp,
} from "lucide-react";

export type NavTabId = "dashboard" | "routines" | "tasks" | "trackers" | "finances";

export interface NavTabItem {
	id: NavTabId;
	label: string;
	shortLabel: string;
	href: string;
	description: string;
	icon: LucideIcon;
	badgeColor: string;
	accentText: string;
}

export const ALL_NAV_TABS: NavTabItem[] = [
	{
		id: "dashboard",
		label: "Today",
		shortLabel: "Today",
		href: "/dashboard",
		description: "Daily agenda, stream timeline & today's progress",
		icon: LayoutDashboard,
		badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
		accentText: "text-teal-600 dark:text-teal-400",
	},
	{
		id: "routines",
		label: "Routines",
		shortLabel: "Routines",
		href: "/routines",
		description: "Recurring habits, time slots & streak milestones",
		icon: CalendarCheck,
		badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
		accentText: "text-blue-600 dark:text-blue-400",
	},
	{
		id: "tasks",
		label: "Tasks & Alarms",
		shortLabel: "Tasks",
		href: "/tasks",
		description: "Prioritized to-do list, scheduled alerts & alarms",
		icon: CheckSquare,
		badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
		accentText: "text-violet-600 dark:text-violet-400",
	},
	{
		id: "trackers",
		label: "Trackers",
		shortLabel: "Trackers",
		href: "/trackers",
		description: "Daily counters, food logs & quantity trackers",
		icon: Calculator,
		badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
		accentText: "text-amber-600 dark:text-amber-400",
	},
	{
		id: "finances",
		label: "Money & Ledger",
		shortLabel: "Money",
		href: "/finances",
		description: "Cash flow, income, expenses & debt settlements",
		icon: TrendingUp,
		badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
		accentText: "text-emerald-600 dark:text-emerald-400",
	},
];

export const NAV_TAB_MAP = new Map<NavTabId, NavTabItem>(
	ALL_NAV_TABS.map((item) => [item.id, item]),
);

export const DEFAULT_ENABLED_TABS: NavTabId[] = [
	"dashboard",
	"routines",
	"tasks",
	"trackers",
	"finances",
];

const VALID_TAB_SET = new Set<string>(DEFAULT_ENABLED_TABS);

export function parseEnabledTabs(raw?: string | null): NavTabId[] {
	if (!raw || typeof raw !== "string") {
		return DEFAULT_ENABLED_TABS;
	}

	const parts = raw
		.split(",")
		.map((p) => p.trim())
		.filter((p): p is NavTabId => VALID_TAB_SET.has(p));

	const uniqueTabs = Array.from(new Set(parts));
	return uniqueTabs.length > 0 ? uniqueTabs : DEFAULT_ENABLED_TABS;
}

export function serializeEnabledTabs(tabs: NavTabId[]): string {
	const valid = tabs.filter((t) => VALID_TAB_SET.has(t));
	return valid.length > 0 ? valid.join(",") : DEFAULT_ENABLED_TABS.join(",");
}
