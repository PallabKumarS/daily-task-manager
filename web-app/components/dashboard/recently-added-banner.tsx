"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	Calculator,
	CalendarCheck,
	CheckSquare,
	ChevronRight,
	Clock,
	Sparkles,
	X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency } from "@/lib/currency-symbols";
import { type RecentAdditionItem, useRecentAdditions } from "@/lib/recent-activity-store";

interface RecentlyAddedBannerProps {
	onViewFinances?: () => void;
	onViewTasks?: () => void;
	onViewRoutines?: () => void;
	onViewTrackers?: () => void;
}

export function RecentlyAddedBanner({
	onViewFinances,
	onViewTasks,
	onViewRoutines,
	onViewTrackers,
}: RecentlyAddedBannerProps) {
	const { user } = useAuth();
	const { latestAddition, recentList, dismissLatest } = useRecentAdditions();
	const [expandedHistory, setExpandedHistory] = React.useState(false);

	if (!latestAddition) {
		return null;
	}

	const renderIcon = (type: RecentAdditionItem["type"]) => {
		switch (type) {
			case "EXPENSE":
				return <ArrowDownRight className="w-5 h-5 text-rose-400" />;
			case "INCOME":
				return <ArrowUpRight className="w-5 h-5 text-emerald-400" />;
			case "EVENT":
			case "TASK":
				return <CheckSquare className="w-5 h-5 text-sky-400" />;
			case "ROUTINE":
				return <CalendarCheck className="w-5 h-5 text-amber-400" />;
			case "TRACKER":
				return <Calculator className="w-5 h-5 text-purple-400" />;
			default:
				return <Sparkles className="w-5 h-5 text-emerald-400" />;
		}
	};

	const getTypeBadge = (type: RecentAdditionItem["type"]) => {
		switch (type) {
			case "EXPENSE":
				return (
					<span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
						Expense Added
					</span>
				);
			case "INCOME":
				return (
					<span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
						Income Logged
					</span>
				);
			case "EVENT":
				return (
					<span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
						Event Scheduled
					</span>
				);
			case "TASK":
				return (
					<span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
						Task Created
					</span>
				);
			case "ROUTINE":
				return (
					<span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
						Routine Activated
					</span>
				);
			case "TRACKER":
				return (
					<span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider">
						Monitor Created
					</span>
				);
		}
	};

	const getBorderAndBg = (type: RecentAdditionItem["type"]) => {
		switch (type) {
			case "EXPENSE":
				return "border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-zinc-900/90 to-zinc-900/80 shadow-rose-950/20";
			case "INCOME":
				return "border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-zinc-900/90 to-zinc-900/80 shadow-emerald-950/20";
			case "EVENT":
			case "TASK":
				return "border-sky-500/40 bg-gradient-to-r from-sky-950/40 via-zinc-900/90 to-zinc-900/80 shadow-sky-950/20";
			case "ROUTINE":
				return "border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-zinc-900/90 to-zinc-900/80 shadow-amber-950/20";
			case "TRACKER":
				return "border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-zinc-900/90 to-zinc-900/80 shadow-purple-950/20";
			default:
				return "border-zinc-800 bg-zinc-900/90";
		}
	};

	const getDestinationLink = (item: RecentAdditionItem) => {
		if (item.type === "EXPENSE" || item.type === "INCOME") return "/finances";
		if (item.type === "EVENT" || item.type === "TASK") return "/tasks";
		if (item.type === "ROUTINE") return "/routines";
		if (item.type === "TRACKER") return "/trackers";
		return "/dashboard";
	};

	return (
		<div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
			<div
				className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl shadow-lg transition-all ${getBorderAndBg(
					latestAddition.type,
				)}`}
			>
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex items-start sm:items-center gap-3 min-w-0">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950/80 border border-zinc-800/80 shadow-inner">
							{renderIcon(latestAddition.type)}
						</div>

						<div className="min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								{getTypeBadge(latestAddition.type)}
								<span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
									<Clock className="w-3 h-3 text-zinc-500" />
									<span>Just added</span>
								</span>
								{latestAddition.category && (
									<span className="rounded-md bg-zinc-800/90 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700/60 font-medium">
										{latestAddition.category}
									</span>
								)}
								{latestAddition.priority && (
									<span className="rounded-md bg-zinc-800/90 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700/60 font-medium uppercase">
										{latestAddition.priority}
									</span>
								)}
							</div>

							<div className="mt-1 flex items-baseline gap-2 flex-wrap">
								<h4 className="text-sm font-bold text-white truncate max-w-md">
									{latestAddition.title}
								</h4>
								{typeof latestAddition.amount === "number" && (
									<span
										className={`text-sm font-extrabold ${
											latestAddition.type === "INCOME" ? "text-emerald-400" : "text-rose-400"
										}`}
									>
										{latestAddition.type === "INCOME" ? "+" : "-"}
										{formatCurrency(latestAddition.amount, user?.currency || "USD")}
									</span>
								)}
								{latestAddition.paymentMethod && (
									<span className="text-[11px] text-zinc-400">
										via {latestAddition.paymentMethod}
									</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2 self-end sm:self-center shrink-0">
						<Link
							href={getDestinationLink(latestAddition)}
							className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition"
						>
							<span>
								View in{" "}
								{latestAddition.type === "EXPENSE" || latestAddition.type === "INCOME"
									? "Ledger"
									: "Module"}
							</span>
							<ChevronRight className="w-3.5 h-3.5" />
						</Link>

						{recentList.length > 1 && (
							<button
								type="button"
								onClick={() => setExpandedHistory((prev) => !prev)}
								className="rounded-xl border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition cursor-pointer"
								title="Toggle recent additions history"
							>
								{recentList.length} items
							</button>
						)}

						<button
							type="button"
							onClick={dismissLatest}
							className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
							title="Dismiss confirmation"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Expanded history drawer if user clicked items button */}
				{expandedHistory && recentList.length > 1 && (
					<div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
						<p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
							Other Recently Added Items
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
							{recentList.slice(1, 7).map((item) => (
								<div
									key={item.id}
									className="flex items-center justify-between rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-2.5 text-xs"
								>
									<div className="flex items-center gap-2 min-w-0">
										{renderIcon(item.type)}
										<div className="min-w-0">
											<p className="font-semibold text-zinc-200 truncate">{item.title}</p>
											<p className="text-[10px] text-zinc-400">{item.category || item.type}</p>
										</div>
									</div>
									{typeof item.amount === "number" && (
										<span
											className={`font-bold ml-2 shrink-0 ${
												item.type === "INCOME" ? "text-emerald-400" : "text-rose-400"
											}`}
										>
											{formatCurrency(item.amount, user?.currency || "USD")}
										</span>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
