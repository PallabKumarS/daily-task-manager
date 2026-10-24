"use client";

import { Bell, CalendarCheck, Cloud, TrendingUp } from "lucide-react";

const FEATURES = [
	{
		icon: CalendarCheck,
		title: "Daily Activity & Routine Loops",
		description:
			"Structure your day into Morning, Afternoon, Evening, and Night blocks. Track consistency streaks with visual confetti milestones.",
		highlight: "Streak Engine",
		color: "emerald",
	},
	{
		icon: Bell,
		title: "Precision Alerts & Dual Alarms",
		description:
			"Never miss a critical event or routine. Receive advance alarms (5m, 15m, 30m, 1h) with synthesized harmonic audio chimes and native system popups.",
		highlight: "Dual Audio & OS Alerts",
		color: "amber",
	},
	{
		icon: TrendingUp,
		title: "Cumulative Spendings & Earnings",
		description:
			"Every coffee, bill, salary, and freelance payout automatically adds up into cumulative net curves across weeks, months, and years.",
		highlight: "Cumulative Flow Analytics",
		color: "teal",
	},
	{
		icon: Cloud,
		title: "Multi-Device Instant Sync",
		description:
			"Seamlessly synchronize routines and finances across your phone, tablet, and PC. Ready to export to Google Drive or package as an APK / EXE.",
		highlight: "Cross-Platform Ready",
		color: "blue",
	},
];

export function FeaturesGrid() {
	return (
		<section className="py-20 border-t border-slate-900 bg-slate-950/40 relative">
			<div className="max-w-6xl mx-auto px-4 sm:px-6">
				<div className="text-center max-w-2xl mx-auto">
					<h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
						Engineered For High Performers
					</h2>
					<p className="mt-2 text-3xl sm:text-4xl font-black text-foreground tracking-tight">
						Everything your daily life demands. Nothing superfluous.
					</p>
					<p className="mt-3 text-sm text-slate-400 leading-relaxed">
						Crafted for rapid execution, memory efficiency, zero cognitive overload, and full data
						sovereignty.
					</p>
				</div>

				<div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
					{FEATURES.map((f) => {
						const Icon = f.icon;
						return (
							<div
								key={f.title}
								className="relative rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl hover:border-slate-700 transition duration-300 group"
							>
								<div className="flex items-center justify-between">
									<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-emerald-400 border border-slate-700/80 group-hover:scale-105 group-hover:bg-emerald-500/10 transition">
										<Icon className="w-6 h-6 stroke-[2]" />
									</div>
									<span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300 border border-slate-700">
										{f.highlight}
									</span>
								</div>

								<h3 className="mt-5 text-xl font-bold text-foreground tracking-tight">{f.title}</h3>
								<p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.description}</p>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
