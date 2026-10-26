"use client";

import { Activity, Calendar, Moon, Settings, SlidersHorizontal, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { NotificationCenter } from "@/components/layout/notification-center";
import { useNavTabs } from "@/components/providers/nav-tabs-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useTodayDate } from "@/lib/date-helpers";

const ROUTE_TITLES: Record<string, string> = {
	"/dashboard": "Today",
	"/routines": "Routines",
	"/tasks": "Tasks & Alarms",
	"/trackers": "Trackers",
	"/finances": "Money",
	"/settings": "Settings",
};

export function AppNavbar() {
	const pathname = usePathname();
	const { readableDate } = useTodayDate();
	const { resolvedTheme, toggleTheme } = useTheme();
	const { setCustomizeOpen } = useNavTabs();

	const activeTitle = React.useMemo(() => {
		const matched = Object.keys(ROUTE_TITLES).find(
			(route) => pathname === route || pathname.startsWith(`${route}/`),
		);
		return matched ? ROUTE_TITLES[matched] : "DayPulse";
	}, [pathname]);

	return (
		<header className="sticky top-[var(--titlebar-height,0px)] z-30 flex h-16 w-full items-center justify-between border-b border-border bg-surface/85 px-4 sm:px-8 backdrop-blur-xl transition-[top] duration-150">
			<div className="flex items-center gap-3">
				<Link href="/dashboard" className="md:hidden flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 text-white shadow-sm shadow-teal-500/20">
						<Activity className="w-4 h-4 stroke-[2.5]" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-extrabold text-foreground leading-tight">
							{activeTitle}
						</span>
						<span className="text-xs text-muted-foreground leading-tight">
							{readableDate || "DayPulse"}
						</span>
					</div>
				</Link>

				<div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground">
					<Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
					<span>{readableDate || "Today"}</span>
				</div>
			</div>

			<div className="flex items-center gap-2 sm:gap-2.5">
				<button
					type="button"
					onClick={toggleTheme}
					className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2/80 text-muted-foreground hover:text-foreground hover:border-border-strong transition cursor-pointer"
					title={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
					aria-label="Toggle color theme"
				>
					{resolvedTheme === "dark" ? (
						<Sun className="w-4 h-4 text-amber-400" />
					) : (
						<Moon className="w-4 h-4 text-indigo-600" />
					)}
				</button>

				<NotificationCenter />

				<button
					type="button"
					onClick={() => setCustomizeOpen(true)}
					className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2/80 text-muted-foreground hover:text-foreground hover:border-border-strong transition cursor-pointer"
					title="Customize navigation tabs"
					aria-label="Customize navigation tabs"
				>
					<SlidersHorizontal className="w-4 h-4" />
				</button>

				<Link
					href="/settings"
					className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2/80 text-muted-foreground hover:text-foreground hover:border-border-strong transition"
					title="Sync & Settings"
				>
					<Settings className="w-4 h-4" />
				</Link>
			</div>
		</header>
	);
}
