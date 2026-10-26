"use client";

import { RotateCcw } from "lucide-react";
import { useNavTabs } from "@/components/providers/nav-tabs-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { ALL_NAV_TABS, type NavTabId } from "@/lib/nav-tabs-config";
import { cn } from "@/lib/utils";

interface CustomizeNavModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function CustomizeNavModal({ isOpen, onClose }: CustomizeNavModalProps) {
	const { enabledTabs, toggleTab, setEnabledTabs, resetToDefault, isSaving } = useNavTabs();

	const handlePreset = async (tabs: NavTabId[]) => {
		await setEnabledTabs(tabs);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Customize Navigation"
			description="Choose which tabs appear in your sidebar and mobile navigation. Changes sync across all your devices."
			maxWidth="md"
		>
			<div className="space-y-5 py-1">
				{/* Preset Quick Actions */}
				<div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border">
					<span className="text-xs font-semibold text-muted-foreground mr-1">Presets:</span>
					<button
						type="button"
						onClick={() => handlePreset(["dashboard", "routines", "tasks", "trackers", "finances"])}
						disabled={isSaving}
						className={cn(
							"px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer",
							enabledTabs.length === 5
								? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold"
								: "border-border bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2",
						)}
					>
						All Tabs (5)
					</button>
					<button
						type="button"
						onClick={() => handlePreset(["dashboard", "finances"])}
						disabled={isSaving}
						className={cn(
							"px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer",
							enabledTabs.length === 2 &&
								enabledTabs.includes("dashboard") &&
								enabledTabs.includes("finances")
								? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold"
								: "border-border bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2",
						)}
					>
						Finance Focus
					</button>
					<button
						type="button"
						onClick={() => handlePreset(["dashboard", "routines", "tasks"])}
						disabled={isSaving}
						className={cn(
							"px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer",
							enabledTabs.length === 3 &&
								enabledTabs.includes("dashboard") &&
								enabledTabs.includes("routines") &&
								enabledTabs.includes("tasks")
								? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold"
								: "border-border bg-surface-2/60 text-muted-foreground hover:text-foreground hover:bg-surface-2",
						)}
					>
						Habits & Tasks
					</button>
				</div>

				{/* Tabs List */}
				<div className="space-y-2">
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
								className={cn(
									"group flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 cursor-pointer select-none",
									isChecked
										? "border-border-strong bg-surface hover:border-teal-500/40"
										: "border-border/60 bg-surface-2/30 opacity-70 hover:opacity-100 hover:bg-surface-2/60",
									isOnlyActive && "cursor-not-allowed",
								)}
							>
								<div className="flex items-center gap-3 min-w-0 pr-3">
									<div
										className={cn(
											"flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 transition-transform duration-150 group-hover:scale-105",
											tab.badgeColor,
										)}
									>
										<Icon className="w-4 h-4 stroke-[2.2]" />
									</div>
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<span className="text-sm font-bold text-foreground truncate">
												{tab.label}
											</span>
											{isOnlyActive && (
												<span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
													Required
												</span>
											)}
										</div>
										<p className="text-xs text-muted-foreground line-clamp-1">{tab.description}</p>
									</div>
								</div>

								{/* Toggle Switch */}
								<div
									className={cn(
										"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out p-0.5",
										isChecked ? "bg-teal-600" : "bg-muted",
										isOnlyActive && "opacity-50",
									)}
								>
									<span
										className={cn(
											"pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out",
											isChecked ? "translate-x-5" : "translate-x-0",
										)}
									/>
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex items-center justify-between pt-3 border-t border-border">
					<button
						type="button"
						onClick={resetToDefault}
						disabled={isSaving}
						className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
					>
						<RotateCcw className="w-3.5 h-3.5" />
						<span>Reset to default</span>
					</button>

					<Button type="button" onClick={onClose} variant="default" className="text-xs h-9 px-4">
						Done
					</Button>
				</div>
			</div>
		</Modal>
	);
}
