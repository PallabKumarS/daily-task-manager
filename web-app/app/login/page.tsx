"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { OnboardingModal } from "@/components/auth/onboarding-modal";
import { useAuth } from "@/components/providers/auth-provider";

export default function LoginPage() {
	const { user, loading } = useAuth();
	const router = useRouter();

	React.useEffect(() => {
		if (!loading && user) {
			router.push("/dashboard");
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
		<div className="min-h-screen bg-slate-950">
			<OnboardingModal isOpen={!user} initialView="CHOICE" />
		</div>
	);
}
