"use client";

import { Activity, ArrowRight, Bell, CheckCircle2, Smartphone, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function HeroSection() {
	const { user } = useAuth();

	return (
		<section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
			{/* Background glow effects */}
			<div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
			<div className="absolute top-1/3 left-1/4 w-[400px] h-[250px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

			<div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 text-center">
				{/* Pill Badge */}
				<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 mb-6 backdrop-blur-md shadow-sm">
					<Activity className="w-3.5 h-3.5" />
					<span>DayPulse • Your All-in-One Daily Rhythm & Financial Ledger</span>
				</div>

				{/* Heading */}
				<h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
					Command Your Day.{" "}
					<span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
						Master Your Wealth.
					</span>
				</h1>

				{/* Subtitle */}
				<p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
					The unified productivity system designed to track daily routines, schedule priority tasks
					and events with advance alerts, and maintain a clear cumulative view of your earnings and
					spendings.
				</p>

				{/* CTA Buttons */}
				<div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
					{user ? (
						<Link href="/dashboard">
							<Button
								size="lg"
								variant="emerald"
								className="gap-2 px-8 text-base shadow-lg shadow-emerald-500/20"
							>
								<span>Go to Dashboard</span>
								<ArrowRight className="w-4 h-4" />
							</Button>
						</Link>
					) : (
						<>
							<Link href="/register">
								<Button
									size="lg"
									variant="emerald"
									className="gap-2 px-8 text-base shadow-lg shadow-emerald-500/20"
								>
									<span>Start Free with DayPulse</span>
									<ArrowRight className="w-4 h-4" />
								</Button>
							</Link>
							<Link href="/login">
								<Button size="lg" variant="secondary" className="px-6 text-base">
									Sign In
								</Button>
							</Link>
						</>
					)}
				</div>

				{/* Feature Badges below CTAs */}
				<div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="w-4 h-4 text-emerald-400" />
						<span>Multi-Device Realtime Sync</span>
					</div>
					<div className="flex items-center gap-2">
						<Bell className="w-4 h-4 text-teal-400" />
						<span>Dual Audio & OS Alerts</span>
					</div>
					<div className="flex items-center gap-2">
						<TrendingUp className="w-4 h-4 text-cyan-400" />
						<span>Cumulative Weekly / Monthly Ledger</span>
					</div>
					<div className="flex items-center gap-2">
						<Smartphone className="w-4 h-4 text-emerald-400" />
						<span>Mobile, Tablet & Desktop Ready</span>
					</div>
				</div>

				{/* Interactive App Mockup Preview */}
				<div className="mt-14 relative mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-950/80 p-3 sm:p-5 shadow-2xl backdrop-blur-2xl ring-1 ring-slate-800">
					<div className="flex items-center justify-between pb-3 px-2 border-b border-slate-800/80">
						<div className="flex items-center gap-2">
							<span className="h-3 w-3 rounded-full bg-red-500/60" />
							<span className="h-3 w-3 rounded-full bg-amber-500/60" />
							<span className="h-3 w-3 rounded-full bg-emerald-500/60" />
						</div>
						<div className="rounded-full bg-slate-900 px-4 py-1 text-[11px] text-slate-400 border border-slate-800">
							daypulse.app/dashboard
						</div>
						<div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
							<span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
							Live Sync Active
						</div>
					</div>

					<div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
						{/* Habit loop preview */}
						<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
							<div className="flex items-center justify-between text-xs text-slate-400 mb-2">
								<span className="font-semibold text-white">Daily Habit Loop</span>
								<span className="text-emerald-400 font-bold">80% Done</span>
							</div>
							<div className="space-y-2">
								<div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 text-xs text-slate-300">
									<div className="h-4 w-4 rounded-md bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
										✓
									</div>
									<span className="line-through text-slate-500">Morning Hydration & Core</span>
								</div>
								<div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 text-xs text-slate-300">
									<div className="h-4 w-4 rounded-md bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
										✓
									</div>
									<span className="line-through text-slate-500">Deep Work Sprint (90m)</span>
								</div>
								<div className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-slate-200">
									<div className="h-4 w-4 rounded-md border border-slate-600" />
									<span>Evening Review & Budget</span>
								</div>
							</div>
						</div>

						{/* Upcoming Task preview */}
						<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
							<div className="flex items-center justify-between text-xs text-slate-400 mb-2">
								<span className="font-semibold text-white">Upcoming Alerts</span>
								<span className="text-amber-400 font-bold">15m lead time</span>
							</div>
							<div className="space-y-2">
								<div className="p-2 rounded-xl bg-slate-800/50 text-xs">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-slate-200">Client Sprint Check-in</span>
										<span className="text-[10px] text-amber-400">3:30 PM</span>
									</div>
									<p className="text-[10px] text-slate-400 mt-0.5">
										Dual audio & desktop chime enabled
									</p>
								</div>
								<div className="p-2 rounded-xl bg-slate-800/50 text-xs">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-slate-200">Review Monthly Ledger</span>
										<span className="text-[10px] text-emerald-400">6:00 PM</span>
									</div>
									<p className="text-[10px] text-slate-400 mt-0.5">
										Finance reconciliation routine
									</p>
								</div>
							</div>
						</div>

						{/* Cumulative Cashflow preview */}
						<div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
							<div className="flex items-center justify-between text-xs text-slate-400 mb-2">
								<span className="font-semibold text-white">Cumulative Flow</span>
								<span className="text-emerald-400 font-bold">+52% Savings</span>
							</div>
							<div className="mt-2 text-xl font-black text-emerald-400">+$4,820.00</div>
							<p className="text-[10px] text-slate-400 mt-0.5">Cumulative net surplus this month</p>
							<div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/60">
								<span className="text-emerald-400">+$6,400 Earnings</span>
								<span className="text-red-400">-$1,580 Spendings</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
