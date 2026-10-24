"use client";

import {
	Bell,
	Cloud,
	Download,
	ExternalLink,
	FileText,
	KeyRound,
	LogOut,
	RefreshCw,
	ShieldCheck,
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
import { AppearanceSettingsCard } from "@/components/settings/appearance-settings-card";
import { SyncScheduleCard } from "@/components/settings/sync-schedule-card";
import { WorkweekSettingsCard } from "@/components/settings/workweek-settings-card";
import { Button } from "@/components/ui/button";
import { CardDeck } from "@/components/ui/card-deck";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, isCapacitorNative } from "@/lib/api-client";
import { extractManifestFromZip, fileToBase64, triggerDownloadArchive } from "@/lib/backup-archive";
import { saveClientGoogleTokens } from "@/lib/client-google-sync";
import { CURRENCIES } from "@/lib/currency-symbols";
import { signInWithNativeGoogle } from "@/lib/native-google-auth";

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
	const { user, updateProfile, logout } = useAuth();
	const searchParams = useSearchParams();
	const { permission, soundEnabled, requestPermission, toggleSound, triggerNotification } =
		useNotifications();

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
	const [showSetupGuide, setShowSetupGuide] = React.useState(false);
	const [customClientId, setCustomClientId] = React.useState("");
	const [customClientSecret, setCustomClientSecret] = React.useState("");
	const [savingGoogleCreds, setSavingGoogleCreds] = React.useState(false);
	const [showCodeInput, setShowCodeInput] = React.useState(false);
	const [manualCodeInput, setManualCodeInput] = React.useState("");
	const [connectingCode, setConnectingCode] = React.useState(false);

	const handleSaveGoogleCredentials = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!customClientId.trim() || !customClientSecret.trim()) {
			toast.error("Please enter both Client ID and Client Secret");
			return;
		}
		setSavingGoogleCreds(true);
		try {
			const res = await api.post("/sync/google/credentials", {
				clientId: customClientId.trim(),
				clientSecret: customClientSecret.trim(),
			});
			if (res.success) {
				toast.success("Google OAuth credentials saved successfully");
				fetchGoogleStatus();
				setCustomClientId("");
				setCustomClientSecret("");
			} else {
				toast.error(res.message || "Failed to save credentials");
			}
		} catch {
			toast.error("Failed to save credentials");
		} finally {
			setSavingGoogleCreds(false);
		}
	};

	const handleExchangeCodeSettings = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = manualCodeInput.trim();
		if (!trimmed) {
			toast.error("Please enter or paste the authorization code or redirect URL");
			return;
		}
		setConnectingCode(true);
		try {
			const res = await api.post("/sync/google/exchange-code", { code: trimmed });
			if (res.success) {
				toast.success("Google Account successfully connected");
				setManualCodeInput("");
				setShowCodeInput(false);
				fetchGoogleStatus();
			} else {
				toast.error(res.message || "Failed to exchange authorization code");
			}
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : "Failed to connect Google account");
		} finally {
			setConnectingCode(false);
		}
	};

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
					lastGoogleSyncAt: res.data.lastSyncAt ?? res.data.lastGoogleSyncAt ?? null,
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
		const handleMessage = (event: MessageEvent) => {
			if (event.data?.type === "daypulse:google_connected") {
				toast.success(`Google Account connected: ${event.data.email || ""}`);
				fetchGoogleStatus();
			}
		};
		window.addEventListener("daypulse:refresh", onSyncRefresh);
		window.addEventListener("daypulse:sync-updated", onSyncRefresh);
		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("daypulse:refresh", onSyncRefresh);
			window.removeEventListener("daypulse:sync-updated", onSyncRefresh);
			window.removeEventListener("message", handleMessage);
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
			const msg = error instanceof Error ? error.message : "Error creating backup download";
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
					description: "Restore routines, tasks, and transactions from this legacy JSON file?",
					confirmText: "Restore Data",
					variant: "default",
				});

				if (!ok) {
					return;
				}

				const res = await api.post<{ summary?: string }>("/sync/restore", parsed);
				if (res.success) {
					toast.success(res.message || "Data restored successfully");
					window.dispatchEvent(new CustomEvent("daypulse:refresh"));
				} else {
					toast.error(res.message || "Failed to restore backup");
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Invalid backup file format";
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
		if (isCapacitorNative()) {
			setSyncingGoogle(true);
			try {
				const nativeUser = await signInWithNativeGoogle();
				if (!nativeUser?.accessToken) {
					throw new Error("No authorization token received from Google Play Services");
				}

				saveClientGoogleTokens({
					accessToken: nativeUser.accessToken,
					email: nativeUser.email,
					expiresIn: 3600,
				});

				toast.success(`Google Account connected: ${nativeUser.email}`);
				fetchGoogleStatus();
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Google Play Services sign-in failed";
				toast.error(message);
			} finally {
				setSyncingGoogle(false);
			}
			return;
		}

		try {
			const res = await api.get<{ url: string }>("/sync/auth-url").catch((err) => ({
				success: false,
				message: err instanceof Error ? err.message : "Failed to obtain Google authorization URL",
				data: null,
			}));

			if (!res.success || !res.data?.url) {
				toast.error(res.message || "Google Cloud sync is not configured or server is offline");
				setShowSetupGuide(true);
				return;
			}

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
				toast.info("Opened Google Sign-In in your browser. Return here once authorized.");
			} else if (typeof window !== "undefined") {
				window.open(res.data.url, "_system") || window.open(res.data.url, "_blank");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to initiate Google OAuth";
			toast.error(message);
			setShowSetupGuide(true);
		}
	};

	const handleUploadGoogle = async () => {
		setSyncingGoogle(true);
		try {
			let res = await api.post("/sync/bidirectional").catch(() => null);
			if (!res?.success) {
				res = await api.post("/sync/upload");
			}

			if (res.success) {
				toast.success(res.message || "Google Drive sync completed!");
				window.dispatchEvent(new CustomEvent("daypulse:refresh"));
				fetchGoogleStatus();
			} else {
				toast.error(res.message || "Failed to sync with Google Drive");
				if (res.message?.includes("expired") || res.message?.includes("reconnect")) {
					setGoogleStatus((prev) => ({ ...prev, connected: false }));
				}
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Network error during Google Drive sync";
			toast.error(msg);
			if (msg.includes("expired") || msg.includes("reconnect")) {
				setGoogleStatus((prev) => ({ ...prev, connected: false }));
			}
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
				if (res.message?.includes("expired") || res.message?.includes("reconnect")) {
					setGoogleStatus((prev) => ({ ...prev, connected: false }));
				}
			}
		} catch (error) {
			const msg =
				error instanceof Error ? error.message : "Network error during Google Drive restore";
			toast.error(msg);
			if (msg.includes("expired") || msg.includes("reconnect")) {
				setGoogleStatus((prev) => ({ ...prev, connected: false }));
			}
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
						localStorage.removeItem(`daypulse_google_connected_${googleStatus.googleEmail}`);
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

	const testAlarm = () => {
		triggerNotification({
			title: "DayPulse System Alert & Chime",
			message:
				"Proactive alert reminder is active! You will be notified ahead of tasks and routines.",
			type: "system",
		});
	};

	return (
		<div className="space-y-6 max-w-4xl">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-foreground">
					System Settings & Cloud Sync
				</h1>
				<p className="text-xs text-foreground-muted mt-1">
					Configure dual color palettes, Google Drive cloud synchronization, profile preferences,
					audio alarms, and local backups.
				</p>
			</div>

			<CardDeck
				items={[
					{
						id: "appearance",
						title: "Appearance, Theme Palettes & Motion",
						node: <AppearanceSettingsCard />,
					},
					{
						id: "cloud_sync",
						title: "Cloud Sync Schedule & Google Drive",
						node: (
							<div className="space-y-6">
								<SyncScheduleCard />

								{/* Google Drive Cloud Sync Hub */}
								<div className="rounded-3xl border border-border bg-surface p-6 shadow-card space-y-5">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
										<div className="flex items-center gap-2.5">
											<div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
												<Cloud className="w-5 h-5" />
											</div>
											<div>
												<h2 className="text-sm font-bold text-foreground">
													Google Drive Cloud Sync
												</h2>
												<p className="text-xs text-foreground-muted">
													Automated multi-device cloud backup & restore
												</p>
											</div>
										</div>

										<div className="flex items-center gap-2">
											<span
												className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
													googleStatus.connected
														? "bg-teal-500/15 text-teal-400 border-teal-500/30"
														: "bg-surface-2 text-foreground-muted border-border"
												}`}
											>
												{googleStatus.connected
													? `Connected: ${googleStatus.googleEmail}`
													: "Not Connected"}
											</span>
										</div>
									</div>

									{/* Sync Status Banner */}
									<div className="p-4 rounded-2xl border border-border bg-surface-2/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
										<div>
											<p className="text-xs font-semibold text-foreground">
												Cloud Archive File:{" "}
												<span className="text-teal-400 font-mono">DayPulse_Backup.json</span>
											</p>
											<p className="text-xs text-foreground-muted mt-0.5">
												{googleStatus.lastGoogleSyncAt
													? `Last synchronized: ${new Date(googleStatus.lastGoogleSyncAt).toLocaleString()}`
													: "No cloud sync performed yet"}
											</p>
										</div>

										<div className="flex flex-wrap items-center gap-2">
											{!googleStatus.connected ? (
												<>
													<Button size="sm" onClick={handleConnectGoogle} className="gap-2 text-xs">
														<KeyRound className="w-4 h-4" />
														<span>Connect Google Drive</span>
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setShowCodeInput(!showCodeInput)}
														className="text-xs text-foreground-muted hover:text-foreground"
													>
														<span>{showCodeInput ? "Hide Code Input" : "Paste Auth Code"}</span>
													</Button>
												</>
											) : (
												<>
													<Button
														size="sm"
														onClick={handleUploadGoogle}
														disabled={syncingGoogle}
														className="gap-2 text-xs"
													>
														<RefreshCw
															className={`w-3.5 h-3.5 ${syncingGoogle ? "animate-spin" : ""}`}
														/>
														<span>{syncingGoogle ? "Syncing..." : "Two-Way Cloud Sync"}</span>
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={handleRestoreGoogle}
														disabled={restoringGoogle}
														className="gap-2 text-xs"
													>
														<Download className="w-3.5 h-3.5" />
														<span>{restoringGoogle ? "Restoring..." : "Restore from Drive"}</span>
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={handleDisconnectGoogle}
														className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs gap-1"
														title="Disconnect Google Account"
													>
														<Unlink className="w-3.5 h-3.5" />
														<span>Disconnect</span>
													</Button>
												</>
											)}
										</div>
									</div>

									{showCodeInput && !googleStatus.connected && (
										<form
											onSubmit={handleExchangeCodeSettings}
											className="rounded-2xl border border-border bg-surface-2/60 p-3.5 space-y-2.5"
										>
											<p className="text-xs text-foreground font-medium leading-relaxed">
												If redirected to localhost in your browser after signing in, copy the
												address bar URL or code and paste here:
											</p>
											<div className="flex flex-col sm:flex-row items-center gap-2">
												<Input
													placeholder="Paste redirect URL or authorization code..."
													value={manualCodeInput}
													onChange={(e) => setManualCodeInput(e.target.value)}
													className="text-xs font-mono break-all h-9 w-full"
												/>
												<Button
													type="submit"
													size="sm"
													disabled={connectingCode || !manualCodeInput.trim()}
													className="w-full sm:w-auto shrink-0 h-9 text-xs font-medium"
												>
													{connectingCode ? "Connecting..." : "Connect Account"}
												</Button>
											</div>
										</form>
									)}

									{/* Collapsible Setup Guide */}
									<div className="pt-1">
										<button
											type="button"
											onClick={() => setShowSetupGuide(!showSetupGuide)}
											className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-teal-400 transition cursor-pointer font-medium"
										>
											<span>
												{showSetupGuide ? "Hide" : "Show"} Google Cloud OAuth setup instructions
												(.env)
											</span>
											<ExternalLink className="w-3 h-3" />
										</button>

										{showSetupGuide && (
											<div className="mt-3 rounded-2xl border border-border bg-surface-2/60 p-4 text-xs text-foreground-muted space-y-2 leading-relaxed">
												<p className="font-semibold text-foreground">
													How to connect your own Google Cloud Client ID & Secret:
												</p>
												<ol className="list-decimal list-inside space-y-1.5 text-foreground-muted">
													<li>
														Go to <strong className="text-foreground">Google Cloud Console</strong>{" "}
														&gt; APIs &amp; Services &gt; Credentials.
													</li>
													<li>
														Create an{" "}
														<strong className="text-foreground">OAuth 2.0 Client ID</strong> (Web
														Application).
													</li>
													<li>
														Add Authorized Redirect URI:
														<div className="mt-1 rounded-lg bg-surface p-2 font-mono text-teal-400 select-all border border-border text-xs break-all space-y-1">
															<div>
																https://day-pulse-web.vercel.app/api/v1/sync/google/callback
															</div>
															<div className="text-foreground-subtle text-xs">
																Desktop/Dev: http://localhost:5000/api/v1/sync/google/callback
															</div>
														</div>
													</li>
													<li>
														Enable the <strong className="text-foreground">Google Drive API</strong>{" "}
														in your project.
													</li>
													<li>
														Add the following keys to your project{" "}
														<strong className="text-foreground">.env</strong> or enter them below:
														<pre className="mt-1 rounded-lg bg-surface p-2 font-mono text-foreground border border-border text-xs overflow-x-auto whitespace-pre-wrap break-all">
															GOOGLE_CLIENT_ID=&quot;your-client-id.apps.googleusercontent.com&quot;
															GOOGLE_CLIENT_SECRET=&quot;your-client-secret&quot;
														</pre>
													</li>
												</ol>

												<form
													onSubmit={handleSaveGoogleCredentials}
													className="mt-4 pt-3 border-t border-border space-y-3"
												>
													<p className="font-semibold text-foreground">
														Save Credentials Directly in DayPulse:
													</p>
													<div className="space-y-1.5">
														<Label htmlFor="settings-google-client-id">Google Client ID</Label>
														<Input
															id="settings-google-client-id"
															placeholder="e.g. 123456789-xxx.apps.googleusercontent.com"
															value={customClientId}
															onChange={(e) => setCustomClientId(e.target.value)}
															className="text-xs font-mono break-all h-9"
														/>
													</div>
													<div className="space-y-1.5">
														<Label htmlFor="settings-google-client-secret">
															Google Client Secret
														</Label>
														<Input
															id="settings-google-client-secret"
															type="password"
															placeholder="e.g. GOCSPX-xxxxxx"
															value={customClientSecret}
															onChange={(e) => setCustomClientSecret(e.target.value)}
															className="text-xs font-mono break-all h-9"
														/>
													</div>
													<Button
														type="submit"
														size="sm"
														disabled={savingGoogleCreds}
														className="gap-2 text-xs"
													>
														<span>
															{savingGoogleCreds ? "Saving..." : "Save Google Credentials"}
														</span>
													</Button>
												</form>
											</div>
										)}
									</div>
								</div>
							</div>
						),
					},
					{
						id: "archive_backup",
						title: "Multi-Collection ZIP Archive & Offline Backup",
						node: (
							<div className="rounded-3xl border border-border bg-surface p-6 shadow-card space-y-4">
								<div className="flex items-center gap-2 pb-3 border-b border-border">
									<FileText className="w-4 h-4 text-teal-400" />
									<h2 className="text-sm font-bold text-foreground">
										Multi-Collection ZIP Archive & Offline Backup
									</h2>
								</div>

								<p className="text-xs text-foreground-muted leading-relaxed">
									Export all database collections (tasks, routines, routine logs, transactions,
									trackers, tracker logs, categories) as individual JSON files bundled into a
									compressed ZIP archive (
									<code className="text-teal-400 font-mono">DayPulse_Backup.zip</code>
									). Includes a verified manifest with SHA256 checksums and safe merge capability.
								</p>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
									<div className="rounded-2xl border border-border bg-surface-2/60 p-5 space-y-3">
										<div className="flex items-center gap-2 text-foreground">
											<Download className="w-4 h-4 text-teal-400" />
											<h3 className="text-xs font-bold uppercase tracking-wider">
												Export ZIP Archive
											</h3>
										</div>
										<p className="text-xs text-foreground-muted">
											Generates a compressed multi-JSON archive of all your collections with
											metadata and checksums.
										</p>
										<Button
											size="sm"
											onClick={handleExportBackup}
											className="w-full gap-2 cursor-pointer"
										>
											<Download className="w-4 h-4" />
											<span>Export Backup ZIP</span>
										</Button>
									</div>

									<div className="rounded-2xl border border-border bg-surface-2/60 p-5 space-y-3">
										<div className="flex items-center gap-2 text-foreground">
											<Upload className="w-4 h-4 text-teal-400" />
											<h3 className="text-xs font-bold uppercase tracking-wider">
												Restore Archive / Backup
											</h3>
										</div>
										<p className="text-xs text-foreground-muted">
											Inspects and restores tasks, routines, and wealth logs from a{" "}
											<code className="text-teal-400">.zip</code>,{" "}
											<code className="text-teal-400">.daypulse</code>, or legacy{" "}
											<code className="text-teal-400">.json</code> file.
										</p>
										<button
											type="button"
											onClick={handlePickBackupFile}
											disabled={importing}
											className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 cursor-pointer transition disabled:opacity-50"
										>
											<Upload className="w-4 h-4" />
											<span>{importing ? "Processing..." : "Select Archive File..."}</span>
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
						),
					},
					{
						id: "notifications",
						title: "Notification & Alarm Engine",
						node: (
							<div className="rounded-3xl border border-border bg-surface p-6 shadow-card space-y-4">
								<div className="flex items-center gap-2 pb-3 border-b border-border">
									<Bell className="w-4 h-4 text-amber-400" />
									<h2 className="text-sm font-bold text-foreground">Notification & Alarm Engine</h2>
								</div>

								<div className="space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-surface-2/60">
										<div>
											<p className="text-sm font-semibold text-foreground">
												OS System & Browser Push
											</p>
											<p className="text-xs text-foreground-muted mt-0.5">
												Displays native popups ahead of scheduled routines and task deadlines.
											</p>
										</div>
										<div className="flex items-center gap-2">
											<span
												className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
													permission === "granted"
														? "bg-teal-500/15 text-teal-400 border-teal-500/30"
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

									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-surface-2/60">
										<div>
											<p className="text-sm font-semibold text-foreground">Harmonic Audio Chime</p>
											<p className="text-xs text-foreground-muted mt-0.5">
												Plays a synthesized dual-tone harmonic chime on alert triggers.
											</p>
										</div>
										<Button
											size="sm"
											variant={soundEnabled ? "default" : "secondary"}
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
										<Button variant="outline" size="sm" onClick={testAlarm} className="gap-2">
											<Bell className="w-4 h-4 text-teal-400" />
											<span>Test Audio Chime & Notification Now</span>
										</Button>
									</div>
								</div>
							</div>
						),
					},
					{
						id: "workweek_categories",
						title: "Categories & Workweek Schedule",
						node: (
							<div className="space-y-6">
								<div className="rounded-3xl border border-border bg-surface p-6 shadow-card space-y-4">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
										<div className="flex items-center gap-2">
											<Tag className="w-4 h-4 text-teal-400" />
											<h2 className="text-sm font-bold text-foreground">
												Categories & Custom Tags
											</h2>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => setCategoryModalOpen(true)}
											className="gap-2 text-xs"
										>
											<Tag className="w-3.5 h-3.5 text-teal-400" />
											<span>Manage All Categories</span>
										</Button>
									</div>
									<p className="text-xs text-foreground-muted leading-relaxed">
										Customize your expense, income, and payment method categories with custom labels
										and color accents.
									</p>
								</div>

								<WorkweekSettingsCard />
							</div>
						),
					},
					{
						id: "profile_account",
						title: "User Profile, Currency & Account",
						node: (
							<div className="space-y-6">
								<div className="rounded-3xl border border-border bg-surface p-6 shadow-card space-y-4">
									<div className="flex items-center gap-2 pb-3 border-b border-border">
										<User className="w-4 h-4 text-teal-400" />
										<h2 className="text-sm font-bold text-foreground">User Profile & Currency</h2>
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

										<Button type="submit" size="sm" disabled={savingProfile}>
											{savingProfile ? "Saving..." : "Save Preferences"}
										</Button>
									</form>
								</div>

								<div className="rounded-3xl border border-border bg-surface p-6 shadow-card space-y-4">
									<div className="flex items-center gap-2 pb-3 border-b border-border">
										<ShieldCheck className="w-4 h-4 text-teal-400" />
										<h2 className="text-sm font-bold text-foreground">Account & Authentication</h2>
									</div>

									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-surface-2/60">
										<div className="space-y-0.5">
											<p className="text-sm font-semibold text-foreground">
												{user?.name || "DayPulse User"}
											</p>
											<p className="text-xs text-foreground-muted">{user?.email}</p>
											<p className="text-xs text-foreground-subtle pt-0.5">
												Default currency:{" "}
												<span className="text-teal-400 font-medium">{user?.currency || "USD"}</span>
											</p>
										</div>
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => logout()}
												className="gap-2 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs"
											>
												<LogOut className="w-3.5 h-3.5" />
												<span>Sign Out</span>
											</Button>
										</div>
									</div>
								</div>
							</div>
						),
					},
				]}
				getKey={(item) => item.id}
				getTitle={(item) => item.title}
				renderCard={(item) => item.node}
				storageKey="settings_sections"
				defaultMode="deck"
				desktopColumns={1}
				sectionLabel="Settings Cards"
			/>

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
