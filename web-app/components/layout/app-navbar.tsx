"use client";

import {
	Activity,
	BellRing,
	Calculator,
	Calendar,
	CheckSquare,
	ChevronDown,
	Clock,
	DollarSign,
	Plus,
	Settings,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { NotificationCenter } from "@/components/layout/notification-center";
import { useTodayDate } from "@/lib/date-helpers";

interface AppNavbarProps {
	onQuickAdd?: (type: "routine" | "task" | "transaction" | "tracker" | "alarm") => void;
}

export function AppNavbar({ onQuickAdd }: AppNavbarProps) {
	const { readableDate } = useTodayDate();
	const [isQuickLogOpen, setIsQuickLogOpen] = React.useState(false);
	const menuRef = React.useRef<HTMLDivElement>(null);

	// Close dropdown on click outside
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
		<header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/80 bg-background/80 px-4 sm:px-8 backdrop-blur-xl">
			<div className="flex items-center gap-3">
				{/* Mobile Logo Brand */}
				<Link href="/dashboard" className="md:hidden flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950">
						<Activity className="w-4 h-4 stroke-[2.5]" />
					</div>
					<span className="text-base font-extrabold text-white">DayPulse</span>
				</Link>

				{/* Date on Tablet/Desktop */}
				<div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
					<Calendar className="w-4 h-4 text-emerald-400" />
					<span>{readableDate || "Today"}</span>
				</div>
			</div>

			<div className="flex items-center gap-3">
				{onQuickAdd && (
					<div className="relative" ref={menuRef}>
						<button
							type="button"
							onClick={() => setIsQuickLogOpen((prev) => !prev)}
							className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-950/40 transition cursor-pointer active:scale-95"
						>
							<Plus className="w-4 h-4" />
							<span className="hidden sm:inline">Quick Log</span>
							<ChevronDown
								className={`w-3.5 h-3.5 transition-transform duration-200 ${
									isQuickLogOpen ? "rotate-180" : ""
								}`}
							/>
						</button>

						{isQuickLogOpen && (
							<div className="absolute right-0 top-full mt-1.5 flex flex-col w-48 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-1.5 shadow-2xl shadow-black/80 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
								<button
									type="button"
									onClick={() => {
										setIsQuickLogOpen(false);
										onQuickAdd("routine");
									}}
									className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
								>
									<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
										<Clock className="w-3.5 h-3.5" />
									</div>
									<span>New Routine</span>
								</button>

								<button
									type="button"
									onClick={() => {
										setIsQuickLogOpen(false);
										onQuickAdd("alarm");
									}}
									className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
								>
									<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
										<BellRing className="w-3.5 h-3.5" />
									</div>
									<span>New Alarm / Alert</span>
								</button>

								<button
									type="button"
									onClick={() => {
										setIsQuickLogOpen(false);
										onQuickAdd("task");
									}}
									className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
								>
									<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
										<CheckSquare className="w-3.5 h-3.5" />
									</div>
									<span>New Task</span>
								</button>

								<button
									type="button"
									onClick={() => {
										setIsQuickLogOpen(false);
										onQuickAdd("tracker");
									}}
									className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
								>
									<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
										<Calculator className="w-3.5 h-3.5" />
									</div>
									<span>New Daily Tracker</span>
								</button>

								<button
									type="button"
									onClick={() => {
										setIsQuickLogOpen(false);
										onQuickAdd("transaction");
									}}
									className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
								>
									<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
										<DollarSign className="w-3.5 h-3.5" />
									</div>
									<span>Spend / Earning</span>
								</button>
							</div>
						)}
					</div>
				)}

				<NotificationCenter />

				<Link
					href="/settings"
					className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/80 hover:border-slate-700 transition"
					title="Sync & Settings"
				>
					<Settings className="w-4 h-4" />
				</Link>
			</div>
		</header>
	);
}
