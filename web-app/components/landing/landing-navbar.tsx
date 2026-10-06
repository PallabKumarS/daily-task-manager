"use client";

import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
	const { user } = useAuth();

	return (
		<header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-xl">
			<div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
				<Link href="/" className="flex items-center gap-2.5">
					<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20">
						<Activity className="w-5 h-5 stroke-[2.5]" />
					</div>
					<span className="text-lg font-black tracking-tight text-white">DayPulse</span>
				</Link>

				<div className="flex items-center gap-3">
					{user ? (
						<Link href="/dashboard">
							<Button size="sm" variant="emerald" className="gap-1.5 shadow-sm">
								<span>Dashboard</span>
								<ArrowRight className="w-3.5 h-3.5" />
							</Button>
						</Link>
					) : (
						<>
							<Link href="/login">
								<Button size="sm" variant="ghost" className="text-slate-300 hover:text-white">
									Sign In
								</Button>
							</Link>
							<Link href="/register">
								<Button size="sm" variant="emerald" className="gap-1.5">
									<span>Get Started</span>
									<ArrowRight className="w-3.5 h-3.5" />
								</Button>
							</Link>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
