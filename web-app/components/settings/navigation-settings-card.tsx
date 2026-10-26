"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useNavTabs } from "@/components/providers/nav-tabs-provider";
import { ALL_NAV_TABS, type NavTabId } from "@/lib/nav-tabs-config";
import { cn } from "@/lib/utils";

export function NavigationSettingsCard() {
	const { enabledTabs, toggleTab, setEnabledTabs, resetToDefault, isSaving } = useNavTabs();

	const handlePreset = async (tabs: NavTabId[]) => {
		await setEnabledTabs(tabs);
	};

	return (
		<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div className="flex items-center gap-2.5">
					<div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-sm shrink-0">
						<SlidersHorizontal className="w-4 h-4" />
					</div>
					<div>
						<h2 className="text-sm font-bold text-foreground">Navigation & Module Tabs</h2>
						<p className="text-[11px] text-muted-foreground">
							Toggle modules displayed in sidebar and bottom navigation
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 self-start sm:self-center">
					<span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-primary-soft text-routine-fg border border-teal-500/25">
						{enabledTabs.length} of {ALL_NAV_TABS.length} Active
					</span>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				<span className="text-[11px] font-semibold text-muted-foreground mr-1">Presets:</span>
				<button
					type="button"
					onClick={() => handlePreset(["dashboard", "routines", "tasks", "trackers", "finances"])}
					disabled={isSaving}
					title="Enable all 5 modules"
					className={cn(
						"px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer",
						enabledTabs.length === 5
							? "border-teal-500 bg-primary-soft text-routine-fg"
							: "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground",
					)}
				>
					All (5)
				</button>
				<button
					type="button"
					onClick={() => handlePreset(["dashboard", "finances"])}
					disabled={isSaving}
					title="Enable only Dashboard and Finances"
					className={cn(
						"px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer",
						enabledTabs.length === 2 &&
							enabledTabs.includes("dashboard") &&
							enabledTabs.includes("finances")
							? "border-teal-500 bg-primary-soft text-routine-fg"
							: "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground",
					)}
				>
					Finance Focus
				</button>
				<button
					type="button"
					onClick={() => handlePreset(["dashboard", "routines", "tasks"])}
					disabled={isSaving}
					title="Enable Dashboard, Routines, and Tasks"
					className={cn(
						"px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer",
						enabledTabs.length === 3 &&
							enabledTabs.includes("dashboard") &&
							enabledTabs.includes("routines") &&
							enabledTabs.includes("tasks")
							? "border-teal-500 bg-primary-soft text-routine-fg"
							: "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground",
					)}
				>
					Habits & Tasks
				</button>
				<button
					type="button"
					onClick={() => handlePreset(["dashboard"])}
					disabled={isSaving}
					title="Minimal mode with only Dashboard"
					className={cn(
						"px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer",
						enabledTabs.length === 1 && enabledTabs.includes("dashboard")
							? "border-teal-500 bg-primary-soft text-routine-fg"
							: "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground",
					)}
				>
					Minimal
				</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{ALL_NAV_TABS.map((tab) => {
					const Icon = tab.icon;
					const isChecked = enabledTabs.includes(tab.id);
					const isOnlyActive = isChecked && enabledTabs.length === 1;

					return (
						<div
							key={tab.id}
							onClick={() => {
								if (!isOnlyActive && !isSaving) {
									toggleTab(tab.id);
								}
							}}
							title={
								isOnlyActive
									? "At least one module tab must remain active"
									: `Click to ${isChecked ? "hide" : "show"} ${tab.label}`
							}
							className={cn(
								"group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
								isChecked
									? "border-border-strong bg-surface hover:border-teal-500/40"
									: "border-border/60 bg-surface-2/30 opacity-70 hover:opacity-100 hover:bg-surface-2/60",
								isOnlyActive && "cursor-not-allowed",
							)}
						>
							<div className="flex items-center gap-2.5 min-w-0 pr-2">
								<div
									className={cn(
										"flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 transition-transform group-hover:scale-105",
										tab.badgeColor,
									)}
								>
									<Icon className="w-4 h-4 stroke-[2.2]" />
								</div>
								<div className="min-w-0">
									<div className="flex items-center gap-1.5">
										<span className="text-xs font-bold text-foreground truncate">{tab.label}</span>
										<span className="text-[10px] font-mono text-muted-foreground">{tab.href}</span>
										{isOnlyActive && (
											<span className="text-[9px] font-semibold uppercase px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
												Min 1
											</span>
										)}
									</div>
									<p className="text-[10px] text-muted-foreground line-clamp-1">
										{tab.description}
									</p>
								</div>
							</div>

							<div
								className={cn(
									"relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 p-0.5",
									isChecked ? "bg-teal-600" : "bg-muted",
									isOnlyActive && "opacity-50",
								)}
							>
								<span
									className={cn(
										"pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200",
										isChecked ? "translate-x-4" : "translate-x-0",
									)}
								/>
							</div>
						</div>
					);
				})}
			</div>

			<div className="flex items-center justify-between pt-1">
				<p className="text-[11px] text-muted-foreground">
					Settings is permanently accessible from the navigation bar.
				</p>
				<button
					type="button"
					onClick={resetToDefault}
					disabled={isSaving}
					title="Reset navigation tabs to default all-active"
					className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
				>
					<RotateCcw className="w-3.5 h-3.5" />
					<span>Reset Defaults</span>
				</button>
			</div>
		</div>
	);
}
