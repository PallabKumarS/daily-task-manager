"use client";

import {
	Bell,
	Cloud,
	Download,
	ExternalLink,
	FileText,
	KeyRound,
	RefreshCw,
	Shield,
	Tag,
	Unlink,
	Upload,
	User,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CategoryManagerModal } from "@/components/categories/category-manager-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { useNotifications } from "@/components/providers/notification-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import {
	extractManifestFromZip,
	fileToBase64,
	triggerDownloadArchive,
} from "@/lib/backup-archive";
import { CURRENCIES } from "@/lib/currency-symbols";

const CURRENCY_SELECT_OPTIONS: SelectOption[] = CURRENCIES.map((c) => ({
	label: `${c.name} (${c.code})`,
	value: c.code,
	badge: c.symbol,
}));

interface GoogleSyncStatus {
	configured: boolean;
	connected: boolean;
	googleEmail: string | null;
	lastGoogleSyncAt: string | null;
}

function SettingsContent() {
	const { user, updateProfile } = useAuth();
	const searchParams = useSearchParams();
	const {
		permission,
		soundEnabled,
		requestPermission,
		toggleSound,
		triggerNotification,
	} = useNotifications();

	const confirm = useConfirm();
	const [name, setName] = React.useState(user?.name || "");
	const [currency, setCurrency] = React.useState(user?.currency || "USD");
	const [savingProfile, setSavingProfile] = React.useState(false);
	const [importing, setImporting] = React.useState(false);
	const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	// Google Sync state
	const [googleStatus, setGoogleStatus] = React.useState<GoogleSyncStatus>({
		configured: false,
		connected: false,
		googleEmail: null,
		lastGoogleSyncAt: null,
	});
	const [syncingGoogle, setSyncingGoogle] = React.useState(false);
	const [restoringGoogle, setRestoringGoogle] = React.useState(false);
	const [simulating, setSimulating] = React.useState(false);
	const [showSetupGuide, setShowSetupGuide] = React.useState(false);

	const fetchGoogleStatus = React.useCallback(async () => {
		try {
			const res = await api.get<{
				isConfigured?: boolean;
				isConnected?: boolean;
				configured?: boolean;
				connected?: boolean;
				email?: string | null;
				googleEmail?: string | null;
				lastSyncAt?: string | null;
				lastGoogleSyncAt?: string | null;
			}>("/sync/status");
			if (res.success && res.data) {
				setGoogleStatus({
					configured: Boolean(res.data.isConfigured ?? res.data.configured),
					connected: Boolean(res.data.isConnected ?? res.data.connected),
					googleEmail: res.data.email ?? res.data.googleEmail ?? null,
					lastGoogleSyncAt:
						res.data.lastSyncAt ?? res.data.lastGoogleSyncAt ?? null,
				});
			}
		} catch {
			// ignore
		}
	}, []);

	React.useEffect(() => {
		if (user) {
			setName(user.name);
			setCurrency(user.currency);
		}
	}, [user]);

	React.useEffect(() => {
		fetchGoogleStatus();

		// Check for callback query params
		const syncStatus = searchParams.get("sync_status");
		const syncError = searchParams.get("sync_error");
		const emailParam = searchParams.get("email");

		if (syncStatus === "connected") {
			const storageKey = `daypulse_google_connected_${emailParam || "user"}`;
			const alreadyNotified =
				typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

			if (!alreadyNotified) {
				toast.success(`Google Account connected: ${emailParam || ""}`);
				if (typeof window !== "undefined") {
					localStorage.setItem(storageKey, "true");
				}
			}
			fetchGoogleStatus();

			// Clean query params from the browser address bar so refresh does not re-trigger
			if (typeof window !== "undefined") {
				window.history.replaceState({}, "", window.location.pathname);
			}
		} else if (syncError) {
			toast.error(`Google connection error: ${decodeURIComponent(syncError)}`);
			if (typeof window !== "undefined") {
				window.history.replaceState({}, "", window.location.pathname);
			}
		}

		const onSyncRefresh = () => fetchGoogleStatus();
		window.addEventListener("daypulse:refresh", onSyncRefresh);
		window.addEventListener("daypulse:sync-updated", onSyncRefresh);
		return () => {
			window.removeEventListener("daypulse:refresh", onSyncRefresh);
			window.removeEventListener("daypulse:sync-updated", onSyncRefresh);
		};
	}, [fetchGoogleStatus, searchParams]);

	const handleSaveProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingProfile(true);
		await updateProfile({ name, currency });
		setSavingProfile(false);
	};

	const handleExportBackup = async () => {
		try {
			const res = await api.post<{
				fileName: string;
				base64: string;
				manifest?: {
					exportedAt: string;
					counts: Record<string, number>;
				};
			}>("/sync/archive/export");

			if (!res.success || !res.data?.base64) {
				toast.error("Failed to generate backup archive");
				return;
			}

			const saveRes = await triggerDownloadArchive(
				res.data.base64,
				res.data.fileName || "DayPulse_Backup.zip",
			);

			if (saveRes.saved) {
				toast.success(
					saveRes.path
						? `Backup archive saved: ${saveRes.path}`
						: `Backup archive downloaded (${res.data.fileName})`,
				);
			}
		} catch (error) {
			const msg =
				error instanceof Error
					? error.message
					: "Error creating backup download";
			toast.error(msg);
		}
	};

	const processArchiveBase64 = async (fileName: string, base64Data: string) => {
		setImporting(true);
		try {
			const isZip =
				fileName.endsWith(".zip") ||
				fileName.endsWith(".daypulse") ||
				base64Data.startsWith("data:application/zip") ||
				base64Data.startsWith("UEsDB");

			if (isZip) {
				const manifest = await extractManifestFromZip(base64Data);

				const confirmDesc = manifest
					? `Backup from ${new Date(manifest.exportedAt).toLocaleDateString()} for ${manifest.user?.name || "User"}.\n\nContains: ${manifest.counts.tasks} tasks, ${manifest.counts.routines} routines, ${manifest.counts.transactions} transactions, ${manifest.counts.trackers} trackers.\n\nExisting records will be safely updated and merged.`
					: "The archive will be safely unpacked and merged with your local database.";

				const ok = await confirm({
					title: "Restore Backup Archive?",
					description: confirmDesc,
					confirmText: "Restore & Merge",
					variant: "default",
				});

				if (!ok) {
					return;
				}

				const res = await api.post<{
					restoredCounts?: Record<string, number>;
					summary?: string;
				}>("/sync/archive/restore", {
					archiveBase64: base64Data,
				});

				if (res.success) {
					toast.success(res.message || "Archive successfully restored");
					window.dispatchEvent(new CustomEvent("daypulse:refresh"));
				} else {
					toast.error(res.message || "Failed to restore archive");
				}
			} else {
				// Legacy JSON fallback
				const clean = base64Data.replace(/^data:.*?;base64,/, "").trim();
				const jsonText = atob(clean);
				const parsed = JSON.parse(jsonText);

				const ok = await confirm({
					title: "Restore Legacy JSON Backup?",
					description:
						"Restore routines, tasks, and transactions from this legacy JSON file?",
					confirmText: "Restore Data",
					variant: "default",
				});

				if (!ok) {
					return;
				}

				const res = await api.post<{ summary?: string }>(
					"/sync/restore",
					parsed,
				);
				if (res.success) {
					toast.success(res.message || "Data restored successfully");
					window.dispatchEvent(new CustomEvent("daypulse:refresh"));
				} else {
					toast.error(res.message || "Failed to restore backup");
				}
			}
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Invalid backup file format";
			toast.error(msg);
		} finally {
			setImporting(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handlePickBackupFile = async () => {
		const electron = (
			window as unknown as {
				electronAPI?: {
					pickBackupFile?: () => Promise<{
						fileName: string;
						base64Data: string;
					} | null>;
				};
			}
		).electronAPI;

		if (electron?.pickBackupFile) {
			const res = await electron.pickBackupFile();
			if (res?.base64Data) {
				await processArchiveBase64(res.fileName, res.base64Data);
			}
		} else {
			fileInputRef.current?.click();
		}
	};

	const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const base64Data = await fileToBase64(file);
		await processArchiveBase64(file.name, base64Data);
	};

	// Google Sync Actions
	const handleConnectGoogle = async () => {
		try {
			const res = await api.get<{ url: string }>("/sync/auth-url");
			if (res.success && res.data.url) {
				const electronApi =
					typeof window !== "undefined"
						? (
								window as unknown as {
									electronAPI?: {
										openExternal?: (u: string) => Promise<boolean>;
									};
								}
							).electronAPI
						: undefined;

				if (electronApi?.openExternal) {
					await electronApi.openExternal(res.data.url);
					toast.info(
						"Opened Google Sign-In in your browser. Return here once authorized.",
					);
				} else {
					window.location.href = res.data.url;
				}
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to initiate Google OAuth";
			toast.error(message);
			setShowSetupGuide(true);
		}
	};

	const handleUploadGoogle = async () => {
		setSyncingGoogle(true);
		try {
			const res = await api.post("/sync/upload");
			if (res.success) {
				toast.success(res.message || "Google Drive sync completed!");
				fetchGoogleStatus();
			} else {
				toast.error(res.message || "Failed to backup to Google Drive");
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Network error during Google Drive sync",
			);
		} finally {
			setSyncingGoogle(false);
		}
	};

	const handleRestoreGoogle = async () => {
		const ok = await confirm({
			title: "Restore from Google Drive",
			description:
				"Are you sure you want to restore data from your Google Drive backup? Any local items modified since the backup will be updated.",
			confirmText: "Restore Data",
			variant: "warning",
		});
		if (!ok) return;
		setRestoringGoogle(true);
		try {
			const res = await api.post("/sync/restore", {});
			if (res.success) {
				toast.success(res.message || "Data restored from Google Drive!");
				window.dispatchEvent(new CustomEvent("daypulse:refresh"));
			} else {
				toast.error(res.message || "Failed to restore from Google Drive");
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Network error during Google Drive restore",
			);
		} finally {
			setRestoringGoogle(false);
		}
	};

	const handleDisconnectGoogle = async () => {
		const ok = await confirm({
			title: "Disconnect Google Account",
			description:
				"Are you sure you want to disconnect your Google Account? Automated cloud backups to Google Drive will be paused.",
			confirmText: "Disconnect",
			variant: "destructive",
		});
		if (!ok) return;
		try {
			const res = await api.post("/sync/disconnect");
			if (res.success) {
				toast.success("Google Account disconnected");
				if (typeof window !== "undefined") {
					if (googleStatus.googleEmail) {
						localStorage.removeItem(
							`daypulse_google_connected_${googleStatus.googleEmail}`,
						);
					}
					localStorage.removeItem("daypulse_google_connected_user");
				}
				fetchGoogleStatus();
			} else {
				toast.error(res.message || "Failed to disconnect");
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Network error");
		}
	};

	const handleSimulateSync = async (action: "upload" | "restore") => {
		setSimulating(true);
		try {
			const res = await api.post("/sync/simulate", {
				action: action === "upload" ? "export" : "import",
			});
			if (res.success) {
				toast.success(res.message);
				fetchGoogleStatus();
				if (action === "restore") {
					window.dispatchEvent(new CustomEvent("daypulse:refresh"));
				}
			} else {
				toast.error(res.message || "Simulation failed");
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Simulation request error",
			);
		} finally {
			setSimulating(false);
		}
	};

	const testAlarm = () => {
		triggerNotification({
			title: "DayPulse System Alert & Chime",
			message:
				"Proactive alert reminder is active! You will be notified ahead of tasks and routines.",
			type: "system",
		});
	};

	return (
		<div className="space-y-8 max-w-4xl">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-white">
					System Settings & Cloud Sync
				</h1>
				<p className="text-xs text-slate-400 mt-1">
					Configure Google Drive cloud synchronization, profile preferences,
					audio alarms, and local backups.
				</p>
			</div>

			{/* Google Drive Cloud Sync Hub */}
			<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
					<div className="flex items-center gap-2.5">
						<div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
							<Cloud className="w-5 h-5" />
						</div>
						<div>
							<h2 className="text-sm font-bold text-white">
								Google Drive Cloud Sync
							</h2>
							<p className="text-[11px] text-slate-400">
								Automated multi-device cloud backup & restore
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<span
							className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
								googleStatus.connected
									? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
									: "bg-slate-800 text-slate-400 border-slate-700"
							}`}
						>
							{googleStatus.connected
								? `Connected: ${googleStatus.googleEmail}`
								: "Not Connected"}
						</span>
					</div>
				</div>

				{/* Sync Status Banner */}
				<div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<p className="text-xs font-semibold text-slate-200">
							Cloud Archive File:{" "}
							<span className="text-emerald-400 font-mono">
								DayPulse_Backup.json
							</span>
						</p>
						<p className="text-[11px] text-slate-400 mt-0.5">
							{googleStatus.lastGoogleSyncAt
								? `Last synchronized: ${new Date(googleStatus.lastGoogleSyncAt).toLocaleString()}`
								: "No cloud sync performed yet"}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{!googleStatus.connected ? (
							<Button
								variant="emerald"
								size="sm"
								onClick={handleConnectGoogle}
								className="gap-2 text-xs"
							>
								<KeyRound className="w-4 h-4" />
								<span>Connect Google Drive</span>
							</Button>
						) : (
							<>
								<Button
									variant="emerald"
									size="sm"
									onClick={handleUploadGoogle}
									disabled={syncingGoogle}
									className="gap-2 text-xs"
								>
									<RefreshCw
										className={`w-3.5 h-3.5 ${syncingGoogle ? "animate-spin" : ""}`}
									/>
									<span>
										{syncingGoogle ? "Syncing..." : "Sync & Backup Now"}
									</span>
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleRestoreGoogle}
									disabled={restoringGoogle}
									className="gap-2 text-xs"
								>
									<Download className="w-3.5 h-3.5" />
									<span>
										{restoringGoogle ? "Restoring..." : "Restore from Drive"}
									</span>
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleDisconnectGoogle}
									className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1"
									title="Disconnect Google Account"
								>
									<Unlink className="w-3.5 h-3.5" />
									<span>Disconnect</span>
								</Button>
							</>
						)}
					</div>
				</div>

				{/* Sandbox Simulation / Instant Test Box */}
				<div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/15 p-4 space-y-2.5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Shield className="w-4 h-4 text-cyan-400" />
							<span className="text-xs font-bold text-slate-200">
								Google Drive Sandbox Simulator
							</span>
						</div>
						<span className="text-[10px] text-cyan-400 uppercase font-semibold">
							Immediate Local Test
						</span>
					</div>
					<p className="text-xs text-slate-300 leading-relaxed">
						Test the complete cloud synchronization lifecycle (payload
						validation, cloud archiving, and atomic database restoration)
						immediately without needing external API credentials.
					</p>
					<div className="flex flex-wrap items-center gap-2 pt-1">
						<Button
							size="sm"
							variant="secondary"
							onClick={() => handleSimulateSync("upload")}
							disabled={simulating}
							className="text-xs gap-1.5"
						>
							<Upload className="w-3.5 h-3.5 text-cyan-400" />
							<span>Simulate Cloud Backup</span>
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => handleSimulateSync("restore")}
							disabled={simulating}
							className="text-xs gap-1.5"
						>
							<Download className="w-3.5 h-3.5 text-emerald-400" />
							<span>Simulate Cloud Restore</span>
						</Button>
					</div>
				</div>

				{/* Collapsible Setup Guide */}
				<div className="pt-1">
					<button
						type="button"
						onClick={() => setShowSetupGuide(!showSetupGuide)}
						className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition cursor-pointer font-medium"
					>
						<span>
							{showSetupGuide ? "Hide" : "Show"} Google Cloud OAuth setup
							instructions (.env)
						</span>
						<ExternalLink className="w-3 h-3" />
					</button>

					{showSetupGuide && (
						<div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 space-y-2 leading-relaxed">
							<p className="font-semibold text-white">
								How to connect your own Google Cloud Client ID & Secret:
							</p>
							<ol className="list-decimal list-inside space-y-1.5 text-slate-400">
								<li>
									Go to{" "}
									<strong className="text-slate-200">
										Google Cloud Console
									</strong>{" "}
									&gt; APIs &amp; Services &gt; Credentials.
								</li>
								<li>
									Create an{" "}
									<strong className="text-slate-200">
										OAuth 2.0 Client ID
									</strong>{" "}
									(Web Application).
								</li>
								<li>
									Add Authorized Redirect URI:
									<div className="mt-1 rounded-lg bg-slate-900 p-2 font-mono text-emerald-400 select-all border border-slate-800">
										http://localhost:3000/api/sync/google/callback
									</div>
								</li>
								<li>
									Enable the{" "}
									<strong className="text-slate-200">Google Drive API</strong>{" "}
									in your project.
								</li>
								<li>
									Add the following keys to your project{" "}
									<strong className="text-slate-200">.env</strong>:
									<pre className="mt-1 rounded-lg bg-slate-900 p-2 font-mono text-slate-300 border border-slate-800">
										GOOGLE_CLIENT_ID=&quot;your-client-id.apps.googleusercontent.com&quot;
										GOOGLE_CLIENT_SECRET=&quot;your-client-secret&quot;
									</pre>
								</li>
							</ol>
						</div>
					)}
				</div>
			</div>

			{/* Manual Multi-Collection ZIP Archive & Offline Backup */}
			<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
				<div className="flex items-center gap-2 pb-3 border-b border-slate-800">
					<FileText className="w-4 h-4 text-emerald-400" />
					<h2 className="text-sm font-bold text-white">
						Multi-Collection ZIP Archive & Offline Backup
					</h2>
				</div>

				<p className="text-xs text-slate-300 leading-relaxed">
					Export all database collections (tasks, routines, routine logs,
					transactions, trackers, tracker logs, categories) as individual JSON
					files bundled into a compressed ZIP archive (
					<code className="text-emerald-400 font-mono">
						DayPulse_Backup.zip
					</code>
					). Includes a verified manifest with SHA256 checksums and safe merge
					capability.
				</p>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
					{/* Export ZIP */}
					<div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3">
						<div className="flex items-center gap-2 text-slate-200">
							<Download className="w-4 h-4 text-emerald-400" />
							<h3 className="text-xs font-bold uppercase tracking-wider">
								Export ZIP Archive
							</h3>
						</div>
						<p className="text-xs text-slate-400">
							Generates a compressed multi-JSON archive of all your collections
							with metadata and checksums.
						</p>
						<Button
							variant="emerald"
							size="sm"
							onClick={handleExportBackup}
							className="w-full gap-2 cursor-pointer"
						>
							<Download className="w-4 h-4" />
							<span>Export Backup ZIP</span>
						</Button>
					</div>

					{/* Import Archive */}
					<div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3">
						<div className="flex items-center gap-2 text-slate-200">
							<Upload className="w-4 h-4 text-teal-400" />
							<h3 className="text-xs font-bold uppercase tracking-wider">
								Restore Archive / Backup
							</h3>
						</div>
						<p className="text-xs text-slate-400">
							Inspects and restores tasks, routines, and wealth logs from a{" "}
							<code className="text-teal-400">.zip</code>,{" "}
							<code className="text-teal-400">.daypulse</code>, or legacy{" "}
							<code className="text-teal-400">.json</code> file.
						</p>
						<button
							type="button"
							onClick={handlePickBackupFile}
							disabled={importing}
							className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/80 cursor-pointer transition disabled:opacity-50"
						>
							<Upload className="w-4 h-4" />
							<span>
								{importing ? "Processing..." : "Select Archive File..."}
							</span>
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".zip,.daypulse,.json,application/zip"
							onChange={handleImportBackup}
							disabled={importing}
							className="hidden"
						/>
					</div>
				</div>
			</div>

			{/* Notification & Audio Engine */}
			<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
				<div className="flex items-center gap-2 pb-3 border-b border-slate-800">
					<Bell className="w-4 h-4 text-amber-400" />
					<h2 className="text-sm font-bold text-white">
						Notification & Alarm Engine
					</h2>
				</div>

				<div className="space-y-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-950">
						<div>
							<p className="text-sm font-semibold text-slate-200">
								OS System & Browser Push
							</p>
							<p className="text-xs text-slate-400 mt-0.5">
								Displays native popups ahead of scheduled routines and task
								deadlines.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<span
								className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
									permission === "granted"
										? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
										: "bg-amber-500/10 text-amber-400 border-amber-500/30"
								}`}
							>
								{permission === "granted" ? "Granted" : "Needs Permission"}
							</span>
							{permission !== "granted" && (
								<Button size="sm" variant="default" onClick={requestPermission}>
									Enable
								</Button>
							)}
						</div>
					</div>

					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-950">
						<div>
							<p className="text-sm font-semibold text-slate-200">
								Harmonic Audio Chime
							</p>
							<p className="text-xs text-slate-400 mt-0.5">
								Plays a synthesized dual-tone harmonic chime on alert triggers.
							</p>
						</div>
						<Button
							size="sm"
							variant={soundEnabled ? "emerald" : "secondary"}
							onClick={toggleSound}
							className="gap-2 self-start sm:self-center"
						>
							{soundEnabled ? (
								<Volume2 className="w-4 h-4" />
							) : (
								<VolumeX className="w-4 h-4" />
							)}
							<span>{soundEnabled ? "Audio On" : "Muted"}</span>
						</Button>
					</div>

					<div className="pt-1">
						<Button
							variant="outline"
							size="sm"
							onClick={testAlarm}
							className="gap-2"
						>
							<Bell className="w-4 h-4 text-emerald-400" />
							<span>Test Audio Chime & Notification Now</span>
						</Button>
					</div>
				</div>
			</div>

			{/* Categories & Custom Tags */}
			<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
					<div className="flex items-center gap-2">
						<Tag className="w-4 h-4 text-emerald-400" />
						<h2 className="text-sm font-bold text-white">
							Categories & Custom Tags
						</h2>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setCategoryModalOpen(true)}
						className="gap-2 text-xs border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
					>
						<Tag className="w-3.5 h-3.5 text-emerald-400" />
						<span>Manage All Categories</span>
					</Button>
				</div>
				<p className="text-xs text-slate-400 leading-relaxed">
					Customize your expense, income, and payment method categories with
					custom labels and color accents.
				</p>
			</div>

			{/* User Preferences */}
			<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
				<div className="flex items-center gap-2 pb-3 border-b border-slate-800">
					<User className="w-4 h-4 text-emerald-400" />
					<h2 className="text-sm font-bold text-white">
						User Profile & Currency
					</h2>
				</div>

				<form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
					<div className="space-y-1.5">
						<Label htmlFor="name">Display Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Your Name"
						/>
					</div>

					<CustomSelect
						label="Default Currency"
						value={currency}
						onChange={(val) => setCurrency(val)}
						options={CURRENCY_SELECT_OPTIONS}
						allowManage={false}
					/>

					<Button
						type="submit"
						variant="emerald"
						size="sm"
						disabled={savingProfile}
					>
						{savingProfile ? "Saving..." : "Save Preferences"}
					</Button>
				</form>
			</div>

			<CategoryManagerModal
				isOpen={categoryModalOpen}
				onClose={() => setCategoryModalOpen(false)}
			/>
		</div>
	);
}

export default function SettingsPage() {
	return (
		<React.Suspense
			fallback={
				<div className="py-20 text-center text-xs text-slate-400">
					Loading settings & cloud sync hub...
				</div>
			}
		>
			<SettingsContent />
		</React.Suspense>
	);
}
