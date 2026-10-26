"use client";

import { Check, Monitor, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { type ThemePreference, useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const THEME_MODES: {
	value: ThemePreference;
	title: string;
	shortDesc: string;
	tooltip: string;
	icon: typeof Monitor;
	accentClass: string;
}[] = [
	{
		value: "system",
		title: "Automatic",
		shortDesc: "Match device",
		tooltip: "Follows your system theme settings automatically",
		icon: Monitor,
		accentClass: "text-blue-500 bg-blue-500/10 border-blue-500/20",
	},
	{
		value: "light",
		title: "Light Mode",
		shortDesc: "Porcelain surfaces",
		tooltip: "Crisp daylight surfaces with high-contrast text",
		icon: Sun,
		accentClass: "text-amber-500 bg-amber-500/10 border-amber-500/20",
	},
	{
		value: "dark",
		title: "Dark Mode",
		shortDesc: "Obsidian slate",
		tooltip: "Rich slate dark mode with soft seafoam accents",
		icon: Moon,
		accentClass: "text-teal-400 bg-teal-500/10 border-teal-500/20",
	},
];

export function AppearanceSettingsCard() {
	const { preference, resolvedTheme, reduceMotion, setPreference, setReduceMotion } = useTheme();

	return (
		<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border">
				<div className="flex items-center gap-2.5">
					<div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-teal-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shrink-0">
						<Palette className="w-4 h-4" />
					</div>
					<div>
						<h2 className="text-sm font-bold text-foreground">Appearance & Motion</h2>
						<p className="text-[11px] text-muted-foreground">
							Dual color themes and interaction transitions
						</p>
					</div>
				</div>

				<span className="self-start sm:self-center text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-primary-soft text-routine-fg border border-teal-500/25">
					Active: {resolvedTheme === "dark" ? "Dark Mode" : "Light Mode"}
				</span>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
				{THEME_MODES.map((mode) => {
					const Icon = mode.icon;
					const isSelected = preference === mode.value;
					return (
						<button
							key={mode.value}
							type="button"
							title={mode.tooltip}
							onClick={() => setPreference(mode.value)}
							className={cn(
								"group relative flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer",
								isSelected
									? "border-teal-500 bg-primary-soft/70 ring-1 ring-teal-500/30"
									: "border-border bg-surface-2/40 hover:border-border-strong hover:bg-surface-2",
							)}
						>
							<div
								className={cn(
									"flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 transition-colors",
									mode.accentClass,
								)}
							>
								<Icon className="w-4 h-4" />
							</div>

							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between gap-1">
									<span className="text-xs font-bold text-foreground truncate">{mode.title}</span>
									{isSelected && (
										<span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white shrink-0">
											<Check className="w-2.5 h-2.5 stroke-[3]" />
										</span>
									)}
								</div>
								<span className="text-[10px] text-muted-foreground block truncate">
									{mode.shortDesc}
								</span>
							</div>
						</button>
					);
				})}
			</div>

			<div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 p-3">
				<div className="flex items-center gap-2.5 min-w-0">
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-task-soft text-task-fg">
						<Sparkles className="w-4 h-4" />
					</div>
					<div className="min-w-0">
						<h3 className="text-xs font-bold text-foreground">Interaction Animations</h3>
						<p className="text-[11px] text-muted-foreground truncate">
							Smooth transitions across modals and cards
						</p>
					</div>
				</div>

				<button
					type="button"
					role="switch"
					aria-checked={!reduceMotion}
					title={!reduceMotion ? "Disable animations" : "Enable animations"}
					onClick={() => setReduceMotion(!reduceMotion)}
					className={cn(
						"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
						!reduceMotion ? "bg-teal-600" : "bg-border-strong",
					)}
				>
					<span
						className={cn(
							"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200",
							!reduceMotion ? "translate-x-4" : "translate-x-0",
						)}
					/>
				</button>
			</div>
		</div>
	);
}
