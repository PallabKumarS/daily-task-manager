import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Terms of Service — DayPulse",
	description: "DayPulse open-source terms of service.",
};

export default function TermsPage() {
	return (
		<main className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto space-y-10">
				<div className="flex items-center justify-between border-b border-slate-800 pb-6">
					<Link
						href="/"
						className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Home
					</Link>
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
						<FileText className="w-3.5 h-3.5" />
						Terms of Service
					</div>
				</div>

				<header className="space-y-3">
					<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
						Terms of Service
					</h1>
					<p className="text-sm text-slate-400">
						Last updated: October 12, 2026 • Effective immediately
					</p>
				</header>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
					<p>
						By downloading, installing, or using DayPulse, you agree to these Terms of Service.
						DayPulse is an open-source productivity, routine tracking, and personal finance software
						licensed under standard open-source terms.
					</p>
				</section>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">2. User Responsibilities & Data Control</h2>
					<p>
						DayPulse stores your data locally on your device. You are responsible for maintaining
						the security of your device, managing your backups, and keeping your Google Cloud
						credentials secure.
					</p>
				</section>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">3. Third-Party Integrations</h2>
					<p>
						Google Drive integration is provided to facilitate file synchronization. Your use of
						Google services is subject to Google's respective Terms of Service and Privacy Policy.
					</p>
				</section>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">4. Disclaimer of Warranty</h2>
					<p>
						DayPulse is provided "as is", without warranty of any kind, express or implied. In no
						event shall the authors or copyright holders be liable for any claim, damages, or other
						liability.
					</p>
				</section>

				<footer className="border-t border-slate-900 pt-8 text-xs text-slate-500">
					© {new Date().getFullYear()} DayPulse. All rights reserved.
				</footer>
			</div>
		</main>
	);
}
