"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	Activity,
	BellRing,
	Calculator,
	Calendar,
	CheckSquare,
	ChevronDown,
	Clock,
	DollarSign,
	Moon,
	Plus,
	Settings,
	Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { NotificationCenter } from "@/components/layout/notification-center";
import { useTheme } from "@/components/providers/theme-provider";
import { useTodayDate } from "@/lib/date-helpers";
import { SPRING_GENTLE } from "@/lib/motion-tokens";

interface AppNavbarProps {
	onQuickAdd?: (type: "routine" | "task" | "transaction" | "tracker" | "alarm") => void;
}

const ROUTE_TITLES: Record<string, string> = {
	"/dashboard": "Today",
	"/routines": "Routines",
	"/tasks": "Tasks & Alarms",
	"/trackers": "Trackers",
	"/finances": "Money",
	"/settings": "Settings",
};

export function AppNavbar({ onQuickAdd }: AppNavbarProps) {
	const pathname = usePathname();
	const { readableDate } = useTodayDate();
	const { resolvedTheme, toggleTheme } = useTheme();
	const [isQuickLogOpen, setIsQuickLogOpen] = React.useState(false);
	const menuRef = React.useRef<HTMLDivElement>(null);

	const activeTitle = React.useMemo(() => {
		const matched = Object.keys(ROUTE_TITLES).find(
			(route) => pathname === route || pathname.startsWith(`${route}/`),
		);
		return matched ? ROUTE_TITLES[matched] : "DayPulse";
	}, [pathname]);

	React.useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsQuickLogOpen(false);
			}
		};

		if (isQuickLogOpen) {
			document.addEventListener("mousedown", handleOutsideClick);
		}
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [isQuickLogOpen]);

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
				{onQuickAdd && (
					<div className="relative" ref={menuRef}>
						<button
							type="button"
							onClick={() => setIsQuickLogOpen((prev) => !prev)}
							className="flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-teal-950/20 transition cursor-pointer"
						>
							<Plus className="w-4 h-4" />
							<span className="hidden sm:inline">Quick Log</span>
							<ChevronDown
								className={`w-3.5 h-3.5 transition-transform duration-200 ${
									isQuickLogOpen ? "rotate-180" : ""
								}`}
							/>
						</button>

						<AnimatePresence>
							{isQuickLogOpen && (
								<motion.div
									initial={{ opacity: 0, scale: 0.95, y: -6 }}
									animate={{ opacity: 1, scale: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.95, y: -6 }}
									transition={SPRING_GENTLE}
									className="absolute right-0 top-full mt-2 flex flex-col w-56 rounded-2xl border border-border-strong bg-surface p-1.5 shadow-[var(--shadow-pop)] z-50"
								>
									<button
										type="button"
										onClick={() => {
											setIsQuickLogOpen(false);
											onQuickAdd("routine");
										}}
										className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-2 rounded-xl transition cursor-pointer"
									>
										<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-routine-soft text-routine-fg">
											<Clock className="w-3.5 h-3.5" />
										</div>
										<span>New Routine</span>
									</button>

									<button
										type="button"
										onClick={() => {
											setIsQuickLogOpen(false);
											onQuickAdd("task");
										}}
										className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-2 rounded-xl transition cursor-pointer"
									>
										<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-task-soft text-task-fg">
											<CheckSquare className="w-3.5 h-3.5" />
										</div>
										<span>New Task</span>
									</button>

									<button
										type="button"
										onClick={() => {
											setIsQuickLogOpen(false);
											onQuickAdd("alarm");
										}}
										className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-2 rounded-xl transition cursor-pointer"
									>
										<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-alarm-soft text-alarm-fg">
											<BellRing className="w-3.5 h-3.5" />
										</div>
										<span>Alarm / Alert</span>
									</button>

									<button
										type="button"
										onClick={() => {
											setIsQuickLogOpen(false);
											onQuickAdd("tracker");
										}}
										className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-2 rounded-xl transition cursor-pointer"
									>
										<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-tracker-soft text-tracker-fg">
											<Calculator className="w-3.5 h-3.5" />
										</div>
										<span>Daily Tracker</span>
									</button>

									<button
										type="button"
										onClick={() => {
											setIsQuickLogOpen(false);
											onQuickAdd("transaction");
										}}
										className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-2 rounded-xl transition cursor-pointer"
									>
										<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-income-soft text-income-fg">
											<DollarSign className="w-3.5 h-3.5" />
										</div>
										<span>Spend / Earning</span>
									</button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				)}

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
