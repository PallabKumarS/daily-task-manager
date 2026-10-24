"use client";

import { Check, Monitor, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { type ThemePreference, useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const THEME_MODES: {
	value: ThemePreference;
	title: string;
	subtitle: string;
	icon: typeof Monitor;
	previewBg: string;
	previewCard: string;
	previewAccent: string;
}[] = [
	{
		value: "system",
		title: "Automatic (Device)",
		subtitle: "Follows your phone or PC system mode automatically",
		icon: Monitor,
		previewBg: "bg-gradient-to-r from-[#f5f7fb] via-[#f5f7fb] to-[#0b0f17]",
		previewCard: "bg-gradient-to-r from-white to-[#111827] border-border-strong",
		previewAccent: "bg-teal-500",
	},
	{
		value: "light",
		title: "Porcelain Light",
		subtitle: "Crisp daylight surfaces with deep jewel accents",
		icon: Sun,
		previewBg: "bg-[#f5f7fb]",
		previewCard: "bg-white border-[#dde4ef]",
		previewAccent: "bg-[#0f766e]",
	},
	{
		value: "dark",
		title: "Obsidian Dark",
		subtitle: "Rich slate layers with soft seafoam & indigo accents",
		icon: Moon,
		previewBg: "bg-[#0b0f17]",
		previewCard: "bg-[#111827] border-[#1f293d]",
		previewAccent: "bg-[#14b8a6]",
	},
];

export function AppearanceSettingsCard() {
	const { preference, resolvedTheme, reduceMotion, setPreference, setReduceMotion } = useTheme();

	return (
		<div className="rounded-3xl border border-border bg-surface p-5 sm:p-6 shadow-[var(--shadow-card)] space-y-5">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
						<Palette className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-sm sm:text-base font-bold text-foreground">
							Appearance, Theme & Motion
						</h2>
						<p className="text-xs text-muted-foreground">
							Dual color palettes that switch automatically with your device mode
						</p>
					</div>
				</div>

				<span className="self-start sm:self-center text-xs px-3 py-1 rounded-full font-semibold bg-primary-soft text-routine-fg border border-teal-500/25">
					Active: {resolvedTheme === "dark" ? "Obsidian Dark" : "Porcelain Light"}
				</span>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
				{THEME_MODES.map((mode) => {
					const Icon = mode.icon;
					const isSelected = preference === mode.value;
					return (
						<button
							key={mode.value}
							type="button"
							onClick={() => setPreference(mode.value)}
							className={cn(
								"group relative flex flex-col text-left rounded-2xl border p-3.5 transition-all cursor-pointer",
								isSelected
									? "border-teal-500 bg-primary-soft/60 ring-2 ring-teal-500/20"
									: "border-border bg-surface-2/50 hover:border-border-strong hover:bg-surface-2",
							)}
						>
							<div
								className={cn(
									"w-full h-16 rounded-xl border border-border p-2.5 flex flex-col justify-between mb-3 overflow-hidden",
									mode.previewBg,
								)}
							>
								<div className={cn("h-3 w-16 rounded-md border", mode.previewCard)} />
								<div className="flex items-center justify-between">
									<div className={cn("h-2.5 w-10 rounded-full", mode.previewAccent)} />
									<div className="h-2.5 w-6 rounded-full bg-teal-500/30" />
								</div>
							</div>

							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
									<span className="text-xs sm:text-sm font-bold text-foreground">{mode.title}</span>
								</div>
								{isSelected && (
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white">
										<Check className="w-3 h-3 stroke-[3]" />
									</span>
								)}
							</div>

							<p className="text-xs text-muted-foreground mt-1 leading-relaxed">{mode.subtitle}</p>
						</button>
					);
				})}
			</div>

			<div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-2/60 p-4">
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-task-soft text-task-fg">
						<Sparkles className="w-4 h-4" />
					</div>
					<div>
						<h3 className="text-xs sm:text-sm font-bold text-foreground">
							Smooth Interaction Animations
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							Enable fluid transitions across cards, tabs, modals, and list updates
						</p>
					</div>
				</div>

				<button
					type="button"
					role="switch"
					aria-checked={!reduceMotion}
					onClick={() => setReduceMotion(!reduceMotion)}
					className={cn(
						"relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
						!reduceMotion ? "bg-teal-600" : "bg-border-strong",
					)}
				>
					<span
						className={cn(
							"pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200",
							!reduceMotion ? "translate-x-5" : "translate-x-0",
						)}
					/>
				</button>
			</div>
		</div>
	);
}
