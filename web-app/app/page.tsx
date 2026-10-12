"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { useAuth } from "@/components/providers/auth-provider";

import { isCapacitorNative } from "@/lib/api-client";

export default function HomePage() {
	const { user, loading } = useAuth();
	const router = useRouter();

	React.useEffect(() => {
		if (!loading) {
			if (user) {
				router.replace("/dashboard");
			} else {
				const isDesktop =
					typeof window !== "undefined" &&
					Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);
				if (isCapacitorNative() || isDesktop) {
					router.replace("/login");
				}
			}
		}
	}, [user, loading, router]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
				<div className="flex flex-col items-center gap-3">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
					<p className="text-xs">Connecting to DayPulse...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
			<LandingNavbar />
			<main className="flex-1">
				<HeroSection />
				<FeaturesGrid />
			</main>
			<LandingFooter />
		</div>
	);
}
