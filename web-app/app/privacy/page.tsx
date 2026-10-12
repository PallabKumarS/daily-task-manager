import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Privacy Policy — DayPulse",
	description: "DayPulse data security and Google Drive integration privacy policy.",
};

export default function PrivacyPage() {
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
						<ShieldCheck className="w-3.5 h-3.5" />
						Privacy & Data Security
					</div>
				</div>

				<header className="space-y-3">
					<h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
						Privacy Policy
					</h1>
					<p className="text-sm text-slate-400">
						Last updated: October 12, 2026 • Effective immediately
					</p>
				</header>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">1. Local-First Architecture</h2>
					<p>
						DayPulse is built as a local-first application. All daily routines, tasks, events, and
						financial ledger entries are stored in an embedded SQLite database on your device. We do
						not operate tracking trackers, behavioral analytics, or third-party ad networks.
					</p>
				</section>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">2. Google Drive Cloud Synchronization</h2>
					<p>
						DayPulse provides optional cloud backup capabilities via Google Drive. When enabled,
						DayPulse requests the following OAuth 2.0 scopes:
					</p>
					<ul className="list-disc pl-5 space-y-2 text-slate-300">
						<li>
							<strong className="text-white">userinfo.email & userinfo.profile:</strong> Used solely
							to identify and display your connected Google account in application settings.
						</li>
						<li>
							<strong className="text-white">https://www.googleapis.com/auth/drive.file:</strong>{" "}
							Allows DayPulse to create, read, and overwrite only the single encrypted backup
							archive file (<code className="text-emerald-400">DayPulse_Backup.json</code>) that the
							application creates in your Google Drive.
						</li>
					</ul>
					<p className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-xs text-slate-400">
						<strong className="text-slate-200">Strict File Isolation:</strong> DayPulse does not
						have access to, read, scan, or modify any other files, folders, photos, or documents in
						your Google Drive. Access is strictly limited to files created by DayPulse itself.
					</p>
				</section>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">3. Token Security & Storage</h2>
					<p>
						Google OAuth access and refresh tokens stored on desktop and self-hosted installations
						are encrypted at rest using AES-256-GCM. On Android, token exchange is managed directly
						by Google Play Services. Tokens are never transmitted to external third parties.
					</p>
				</section>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">4. Data Deletion & Revocation</h2>
					<p>
						You may disconnect Google Drive at any time from DayPulse Settings. You can also revoke
						DayPulse's access at any time via your{" "}
						<a
							href="https://myaccount.google.com/permissions"
							target="_blank"
							rel="noreferrer"
							className="text-emerald-400 hover:underline"
						>
							Google Account Permissions
						</a>
						, and delete your backup archive from Google Drive.
					</p>
				</section>

				<section className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-900 pt-6">
					<h2 className="text-lg font-bold text-white">5. Open-Source Transparency</h2>
					<p>
						DayPulse is an open-source project. You can inspect the entire codebase, including OAuth
						exchange handlers and backup dispatchers, at:
					</p>
					<p>
						<a
							href="https://github.com/PallabKumarS/daily-task-manager"
							target="_blank"
							rel="noreferrer"
							className="text-emerald-400 hover:underline font-mono text-xs"
						>
							https://github.com/PallabKumarS/daily-task-manager
						</a>
					</p>
				</section>

				<footer className="border-t border-slate-900 pt-8 text-xs text-slate-500">
					© {new Date().getFullYear()} DayPulse. All rights reserved.
				</footer>
			</div>
		</main>
	);
}
