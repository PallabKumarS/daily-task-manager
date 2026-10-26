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
import { NavigationSettingsCard } from "@/components/settings/navigation-settings-card";
import { SyncScheduleCard } from "@/components/settings/sync-schedule-card";
import { WorkweekSettingsCard } from "@/components/settings/workweek-settings-card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, isCapacitorNative } from "@/lib/api-client";
import { extractManifestFromZip, fileToBase64, triggerDownloadArchive } from "@/lib/backup-archive";
import { saveClientGoogleTokens } from "@/lib/client-google-sync";
import { CURRENCIES } from "@/lib/currency-symbols";
import { signInWithNativeGoogle } from "@/lib/native-google-auth";
import { cn } from "@/lib/utils";

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
			toast.error("Please enter authorization code or URL");
			return;
		}
		setConnectingCode(true);
		try {
			const res = await api.post("/sync/google/exchange-code", { code: trimmed });
			if (res.success) {
				toast.success("Google Account connected");
				setManualCodeInput("");
				setShowCodeInput(false);
				fetchGoogleStatus();
			} else {
				toast.error(res.message || "Failed to exchange code");
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
					? `Backup from ${new Date(manifest.exportedAt).toLocaleDateString()} for ${manifest.user?.name || "User"}.\n\nContains: ${manifest.counts.tasks} tasks, ${manifest.counts.routines} routines, ${manifest.counts.transactions} transactions, ${manifest.counts.trackers} trackers.\n\nExisting records will be safely merged.`
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
				toast.success(res.message || "Google Drive sync completed");
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
				toast.success(res.message || "Data restored from Google Drive");
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
			message: "Audio alert reminder is active! You will be notified ahead of tasks and routines.",
			type: "system",
		});
	};

	return (
		<div className="w-full max-w-7xl mx-auto space-y-4 px-1 sm:px-0">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border">
				<div>
					<h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
						Settings & System Preferences
					</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Customize appearance, active modules, cloud synchronization, and backup archives
					</p>
				</div>
			</div>

			{/* Responsive 2-Column Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
				{/* Column 1: Appearance, Navigation, Profile, Categories */}
				<div className="space-y-4">
					<AppearanceSettingsCard />

					<NavigationSettingsCard />

					{/* Profile & Account Settings */}
					<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
						<div className="flex items-center gap-2.5 pb-3 border-b border-border">
							<div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 flex items-center justify-center shrink-0">
								<User className="w-4 h-4" />
							</div>
							<div>
								<h2 className="text-sm font-bold text-foreground">Profile & Currency</h2>
								<p className="text-[11px] text-muted-foreground">
									Display name and financial denomination
								</p>
							</div>
						</div>

						<form onSubmit={handleSaveProfile} className="space-y-3">
							<div className="space-y-1">
								<Label htmlFor="profile-name" className="text-xs font-semibold text-foreground">
									Display Name
								</Label>
								<Input
									id="profile-name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Your Name"
									title="Name displayed across the app"
									className="text-xs h-9"
								/>
							</div>

							<div className="space-y-1">
								<Label className="text-xs font-semibold text-foreground">Default Currency</Label>
								<CustomSelect
									value={currency}
									onChange={(val) => setCurrency(val)}
									options={CURRENCY_SELECT_OPTIONS}
									allowManage={false}
								/>
							</div>

							<Button
								type="submit"
								size="sm"
								disabled={savingProfile}
								title="Save profile and currency preferences"
								className="text-xs h-8"
							>
								{savingProfile ? "Saving..." : "Save Preferences"}
							</Button>
						</form>

						{/* Account info bar */}
						<div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									<ShieldCheck className="w-3.5 h-3.5 text-teal-500 shrink-0" />
									<span className="text-xs font-semibold text-foreground truncate">
										{user?.email || "Local Account"}
									</span>
								</div>
								<span className="text-[10px] text-muted-foreground block truncate">
									Active Currency:{" "}
									<strong className="text-foreground">{user?.currency || "USD"}</strong>
								</span>
							</div>

							<Button
								variant="outline"
								size="sm"
								onClick={() => logout()}
								title="Sign out of your DayPulse account"
								className="gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-8 shrink-0"
							>
								<LogOut className="w-3.5 h-3.5" />
								<span>Sign Out</span>
							</Button>
						</div>
					</div>

					{/* Categories & Custom Tags */}
					<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-3">
						<div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
							<div className="flex items-center gap-2.5">
								<div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 flex items-center justify-center shrink-0">
									<Tag className="w-4 h-4" />
								</div>
								<div>
									<h2 className="text-sm font-bold text-foreground">Categories & Tags</h2>
									<p className="text-[11px] text-muted-foreground">
										Expense, income, and payment categories
									</p>
								</div>
							</div>

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setCategoryModalOpen(true)}
								title="Open category and tag manager"
								className="gap-1.5 text-xs h-8"
							>
								<Tag className="w-3.5 h-3.5 text-teal-400" />
								<span>Manage Categories</span>
							</Button>
						</div>

						<p className="text-[11px] text-muted-foreground">
							Customize color badges, icons, and labels for your financial transactions.
						</p>
					</div>
				</div>

				{/* Column 2: Cloud Sync, Google Drive, Backups, Workweek, Notifications */}
				<div className="space-y-4">
					<SyncScheduleCard />

					{/* Google Drive Cloud Sync Hub */}
					<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-3.5">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border">
							<div className="flex items-center gap-2.5">
								<div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
									<Cloud className="w-4 h-4" />
								</div>
								<div>
									<h2 className="text-sm font-bold text-foreground">Google Drive Cloud Sync</h2>
									<p className="text-[11px] text-muted-foreground">
										Encrypted cloud backup & multi-device sync
									</p>
								</div>
							</div>

							<span
								className={cn(
									"self-start sm:self-center text-[11px] px-2.5 py-0.5 rounded-full font-semibold border",
									googleStatus.connected
										? "bg-teal-500/15 text-teal-400 border-teal-500/30"
										: "bg-surface-2 text-muted-foreground border-border",
								)}
							>
								{googleStatus.connected
									? `Connected: ${googleStatus.googleEmail}`
									: "Not Connected"}
							</span>
						</div>

						{/* Action Buttons & Status */}
						<div className="p-3 rounded-xl border border-border bg-surface-2/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
							<div className="min-w-0">
								<p className="text-xs font-semibold text-foreground truncate">
									File: <span className="text-teal-400 font-mono">DayPulse_Backup.json</span>
								</p>
								<p className="text-[10px] text-muted-foreground truncate mt-0.5">
									{googleStatus.lastGoogleSyncAt
										? `Last synced: ${new Date(googleStatus.lastGoogleSyncAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
										: "No cloud sync executed yet"}
								</p>
							</div>

							<div className="flex flex-wrap items-center gap-1.5">
								{!googleStatus.connected ? (
									<>
										<Button
											size="sm"
											onClick={handleConnectGoogle}
											title="Authenticate with Google Drive to enable cloud backup"
											className="gap-1.5 text-xs h-8"
										>
											<KeyRound className="w-3.5 h-3.5" />
											<span>Connect Drive</span>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setShowCodeInput(!showCodeInput)}
											title="Paste authorization code or callback URL manually"
											className="text-xs h-8 text-muted-foreground hover:text-foreground"
										>
											<span>{showCodeInput ? "Hide Code" : "Paste Code"}</span>
										</Button>
									</>
								) : (
									<>
										<Button
											size="sm"
											onClick={handleUploadGoogle}
											disabled={syncingGoogle}
											title="Synchronize local changes with Google Drive backup"
											className="gap-1.5 text-xs h-8"
										>
											<RefreshCw className={cn("w-3.5 h-3.5", syncingGoogle && "animate-spin")} />
											<span>{syncingGoogle ? "Syncing..." : "Sync Now"}</span>
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={handleRestoreGoogle}
											disabled={restoringGoogle}
											title="Restore database from latest Google Drive backup"
											className="gap-1.5 text-xs h-8"
										>
											<Download className="w-3.5 h-3.5" />
											<span>{restoringGoogle ? "Restoring..." : "Restore"}</span>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={handleDisconnectGoogle}
											title="Disconnect Google Drive"
											className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-8 px-2"
										>
											<Unlink className="w-3.5 h-3.5" />
										</Button>
									</>
								)}
							</div>
						</div>

						{/* Manual code paste input */}
						{showCodeInput && !googleStatus.connected && (
							<form
								onSubmit={handleExchangeCodeSettings}
								className="rounded-xl border border-border bg-surface-2/40 p-2.5 space-y-2"
							>
								<p className="text-[11px] text-muted-foreground leading-tight">
									Paste redirect URL or authorization code from browser:
								</p>
								<div className="flex flex-col sm:flex-row items-center gap-1.5">
									<Input
										placeholder="Paste code or URL..."
										value={manualCodeInput}
										onChange={(e) => setManualCodeInput(e.target.value)}
										title="Authorization code"
										className="text-xs font-mono h-8 w-full"
									/>
									<Button
										type="submit"
										size="sm"
										disabled={connectingCode || !manualCodeInput.trim()}
										title="Connect account with authorization code"
										className="w-full sm:w-auto shrink-0 h-8 text-xs font-medium"
									>
										{connectingCode ? "Connecting..." : "Connect"}
									</Button>
								</div>
							</form>
						)}

						{/* Collapsible OAuth Setup Instructions */}
						<div className="pt-0.5">
							<button
								type="button"
								onClick={() => setShowSetupGuide(!showSetupGuide)}
								title="View Google Cloud OAuth configuration instructions"
								className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-teal-400 transition cursor-pointer font-medium"
							>
								<span>
									{showSetupGuide ? "Hide" : "Show"} Custom Google Cloud OAuth setup (.env)
								</span>
								<ExternalLink className="w-3 h-3" />
							</button>

							{showSetupGuide && (
								<div className="mt-2.5 rounded-xl border border-border bg-surface-2/40 p-3 text-[11px] text-muted-foreground space-y-2">
									<p className="font-semibold text-foreground">
										Custom Google Cloud Client ID & Secret:
									</p>
									<ol className="list-decimal list-inside space-y-1 text-muted-foreground">
										<li>
											Open <strong className="text-foreground">Google Cloud Console</strong> &gt;
											APIs &amp; Credentials.
										</li>
										<li>
											Create <strong className="text-foreground">OAuth 2.0 Client ID</strong> (Web
											App).
										</li>
										<li>
											Authorized Redirect URI:
											<span className="block mt-0.5 rounded bg-surface p-1.5 font-mono text-teal-400 select-all border border-border text-[10px] break-all">
												https://day-pulse-web.vercel.app/api/v1/sync/google/callback
											</span>
										</li>
										<li>Enable the Google Drive API in your project.</li>
									</ol>

									<form
										onSubmit={handleSaveGoogleCredentials}
										className="pt-2 border-t border-border space-y-2"
									>
										<div className="space-y-1">
											<Label htmlFor="google-client-id" className="text-[11px]">
												Client ID
											</Label>
											<Input
												id="google-client-id"
												placeholder="your-client-id.apps.googleusercontent.com"
												value={customClientId}
												onChange={(e) => setCustomClientId(e.target.value)}
												className="text-[11px] font-mono h-8"
											/>
										</div>
										<div className="space-y-1">
											<Label htmlFor="google-client-secret" className="text-[11px]">
												Client Secret
											</Label>
											<Input
												id="google-client-secret"
												type="password"
												placeholder="GOCSPX-xxxxxx"
												value={customClientSecret}
												onChange={(e) => setCustomClientSecret(e.target.value)}
												className="text-[11px] font-mono h-8"
											/>
										</div>
										<Button
											type="submit"
											size="sm"
											disabled={savingGoogleCreds}
											title="Save credentials to local environment"
											className="text-xs h-8"
										>
											{savingGoogleCreds ? "Saving..." : "Save Credentials"}
										</Button>
									</form>
								</div>
							)}
						</div>
					</div>

					{/* Multi-Collection ZIP Archive & Offline Backup */}
					<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-3">
						<div className="flex items-center gap-2 pb-2 border-b border-border">
							<div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 flex items-center justify-center shrink-0">
								<FileText className="w-4 h-4" />
							</div>
							<div>
								<h2 className="text-sm font-bold text-foreground">
									Multi-Collection ZIP Archive & Backup
								</h2>
								<p className="text-[11px] text-muted-foreground">
									Export or restore complete database archive (.zip / .json)
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
							{/* Export Box */}
							<div className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-2 flex flex-col justify-between">
								<div>
									<div className="flex items-center gap-1.5 text-foreground">
										<Download className="w-3.5 h-3.5 text-teal-400" />
										<h3 className="text-xs font-bold uppercase tracking-wider">Export ZIP</h3>
									</div>
									<p className="text-[10px] text-muted-foreground mt-1">
										Download all collections with SHA256 checksums.
									</p>
								</div>
								<Button
									size="sm"
									onClick={handleExportBackup}
									title="Download compressed ZIP backup of all tasks, routines, and wealth data"
									className="w-full gap-1.5 text-xs h-8 cursor-pointer"
								>
									<Download className="w-3.5 h-3.5" />
									<span>Export Backup ZIP</span>
								</Button>
							</div>

							{/* Restore Box */}
							<div className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-2 flex flex-col justify-between">
								<div>
									<div className="flex items-center gap-1.5 text-foreground">
										<Upload className="w-3.5 h-3.5 text-teal-400" />
										<h3 className="text-xs font-bold uppercase tracking-wider">Restore Archive</h3>
									</div>
									<p className="text-[10px] text-muted-foreground mt-1">
										Import .zip, .daypulse, or legacy .json file.
									</p>
								</div>
								<button
									type="button"
									onClick={handlePickBackupFile}
									disabled={importing}
									title="Select a backup file from your device to restore"
									className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2 cursor-pointer transition disabled:opacity-50 h-8"
								>
									<Upload className="w-3.5 h-3.5" />
									<span>{importing ? "Processing..." : "Select File..."}</span>
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

					<WorkweekSettingsCard />

					{/* Notification & Alarm Engine */}
					<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-3">
						<div className="flex items-center gap-2 pb-2 border-b border-border">
							<div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
								<Bell className="w-4 h-4" />
							</div>
							<div>
								<h2 className="text-sm font-bold text-foreground">Notification & Alerts</h2>
								<p className="text-[11px] text-muted-foreground">
									OS push notifications and audio chimes
								</p>
							</div>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border bg-surface-2/40">
								<div className="min-w-0">
									<p className="text-xs font-semibold text-foreground">System Push Notifications</p>
									<p className="text-[10px] text-muted-foreground truncate">
										Popups for routine and task reminders
									</p>
								</div>
								<div className="flex items-center gap-1.5 shrink-0">
									<span
										className={cn(
											"text-[10px] px-2 py-0.5 rounded-full font-semibold border",
											permission === "granted"
												? "bg-teal-500/15 text-teal-400 border-teal-500/30"
												: "bg-amber-500/10 text-amber-400 border-amber-500/30",
										)}
									>
										{permission === "granted" ? "Granted" : "Disabled"}
									</span>
									{permission !== "granted" && (
										<Button
											size="sm"
											variant="default"
											onClick={requestPermission}
											title="Request OS notification permission"
											className="text-xs h-7 px-2.5"
										>
											Enable
										</Button>
									)}
								</div>
							</div>

							<div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border bg-surface-2/40">
								<div className="min-w-0">
									<p className="text-xs font-semibold text-foreground">Harmonic Audio Chime</p>
									<p className="text-[10px] text-muted-foreground truncate">
										Dual-tone chime on alert triggers
									</p>
								</div>
								<Button
									size="sm"
									variant={soundEnabled ? "default" : "secondary"}
									onClick={toggleSound}
									title={soundEnabled ? "Mute audio alarms" : "Enable audio alarms"}
									className="gap-1.5 text-xs h-7 px-2.5 shrink-0"
								>
									{soundEnabled ? (
										<Volume2 className="w-3.5 h-3.5" />
									) : (
										<VolumeX className="w-3.5 h-3.5" />
									)}
									<span>{soundEnabled ? "Audio On" : "Muted"}</span>
								</Button>
							</div>

							<Button
								variant="outline"
								size="sm"
								onClick={testAlarm}
								title="Trigger a test audio alert and system popup"
								className="gap-1.5 text-xs h-8 w-full"
							>
								<Bell className="w-3.5 h-3.5 text-teal-400" />
								<span>Test Notification & Chime</span>
							</Button>
						</div>
					</div>
				</div>
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
				<div className="py-20 text-center text-xs text-muted-foreground">
					Loading settings & cloud sync hub...
				</div>
			}
		>
			<SettingsContent />
		</React.Suspense>
	);
}
