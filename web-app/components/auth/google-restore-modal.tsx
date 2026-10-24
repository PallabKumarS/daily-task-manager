"use client";

import {
	AlertCircle,
	CheckCircle2,
	Cloud,
	ExternalLink,
	FileArchive,
	KeyRound,
	RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, isCapacitorNative, setAuthToken } from "@/lib/api-client";
import { restoreGoogleDriveBackup, saveClientGoogleTokens } from "@/lib/client-google-sync";
import { signInWithNativeGoogle } from "@/lib/native-google-auth";

interface GoogleRestoreModalProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenFileRestore?: () => void;
}

interface GoogleRestoreResult {
	user: {
		id: string;
		email: string;
		name: string;
		currency: string;
	};
	token: string;
	summary: string;
	restoredAt: string;
}

export function GoogleRestoreModal({
	isOpen,
	onClose,
	onOpenFileRestore,
}: GoogleRestoreModalProps) {
	const router = useRouter();
	const { refreshUser } = useAuth();

	const [status, setStatus] = React.useState<"idle" | "authorizing" | "restoring" | "success">(
		"idle",
	);
	const [statusText, setStatusText] = React.useState("");
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
	const [isConfigured, setIsConfigured] = React.useState<boolean | null>(null);
	const [showConfigForm, setShowConfigForm] = React.useState(false);
	const [clientIdInput, setClientIdInput] = React.useState("");
	const [clientSecretInput, setClientSecretInput] = React.useState("");
	const [savingCredentials, setSavingCredentials] = React.useState(false);
	const [authCodeInput, setAuthCodeInput] = React.useState("");
	const [submittingCode, setSubmittingCode] = React.useState(false);

	const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

	const stopPolling = React.useCallback(() => {
		if (pollTimerRef.current) {
			clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
		}
	}, []);

	const resetState = React.useCallback(() => {
		stopPolling();
		setStatus("idle");
		setStatusText("");
		setErrorMessage(null);
		setAuthCodeInput("");
		setSubmittingCode(false);
	}, [stopPolling]);

	const handleModalClose = React.useCallback(() => {
		resetState();
		onClose();
	}, [resetState, onClose]);

	React.useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data?.type === "daypulse:google_connected") {
				stopPolling();
				setStatus("success");
				setStatusText("Restored successfully. Finalizing session...");
				refreshUser().then(() => {
					toast.success("Workspace restored from Google Drive successfully");
					setTimeout(() => {
						handleModalClose();
						router.push("/dashboard");
					}, 1200);
				});
			}
		};
		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
			stopPolling();
		};
	}, [stopPolling, refreshUser, router, handleModalClose]);

	React.useEffect(() => {
		if (isOpen) {
			api
				.get<{ configured: boolean; clientId?: string }>("/auth/google/credentials")
				.then((res) => {
					if (res.success && res.data) {
						setIsConfigured(Boolean(res.data.configured));
					}
				})
				.catch(() => {
					setIsConfigured(false);
				});
		}
	}, [isOpen]);

	const handleSaveCredentials = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!clientIdInput.trim() || !clientSecretInput.trim()) {
			toast.error("Please enter both Client ID and Client Secret");
			return;
		}

		setSavingCredentials(true);
		try {
			const res = await api.post("/auth/google/credentials", {
				clientId: clientIdInput.trim(),
				clientSecret: clientSecretInput.trim(),
			});

			if (res.success) {
				toast.success("Google OAuth credentials saved successfully");
				setIsConfigured(true);
				setShowConfigForm(false);
				setErrorMessage(null);
				handleStartGoogleRestore();
			} else {
				toast.error(res.message || "Failed to save credentials");
			}
		} catch {
			toast.error("An unexpected error occurred while saving credentials");
		} finally {
			setSavingCredentials(false);
		}
	};

	const handleExchangeCode = async (codeToSubmit: string) => {
		const trimmed = codeToSubmit.trim();
		if (!trimmed) {
			toast.error("Please enter or paste the authorization code or redirect URL");
			return;
		}

		setSubmittingCode(true);
		stopPolling();
		setStatus("restoring");
		setStatusText("Exchanging authorization code and restoring backup...");

		try {
			const res = await api.post<GoogleRestoreResult>("/auth/google/restore-code", {
				code: trimmed,
			});

			if (res.success && res.data?.token) {
				setStatus("success");
				setStatusText("Restored successfully. Finalizing session...");
				setAuthToken(res.data.token);
				await refreshUser();
				toast.success(res.data.summary || "Workspace restored from Google Drive successfully");
				setTimeout(() => {
					handleModalClose();
					router.push("/dashboard");
				}, 1200);
			} else {
				const err = res.message || "Failed to restore using provided code";
				setErrorMessage(err);
				setStatus("idle");
				toast.error(err);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to complete restore";
			setErrorMessage(msg);
			setStatus("idle");
			toast.error(msg);
		} finally {
			setSubmittingCode(false);
		}
	};

	const handleStartGoogleRestore = async () => {
		setErrorMessage(null);

		if (isCapacitorNative()) {
			setStatus("authorizing");
			setStatusText("Opening Google Play Services...");
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

				setStatus("restoring");
				setStatusText("Locating and downloading backup from Google Drive...");

				const restoreRes = await restoreGoogleDriveBackup(nativeUser.accessToken);
				setStatus("success");
				setStatusText("Restored successfully. Finalizing session...");

				if (restoreRes.token) {
					setAuthToken(restoreRes.token);
				}
				await refreshUser();

				toast.success(restoreRes.message || "Workspace restored from Google Drive successfully");

				setTimeout(() => {
					handleModalClose();
					router.push("/dashboard");
				}, 1200);
				return;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : "Google Play Services sign-in failed";
				setErrorMessage(msg);
				setStatus("idle");
				toast.error(msg);
				return;
			}
		}

		setStatus("authorizing");
		setStatusText("Opening Google Sign-In...");

		try {
			const res = await api.get<{ url: string }>("/auth/google/restore-url");
			if (!res.success || !res.data?.url) {
				const err = res.message || "Failed to initiate Google authorization";
				setErrorMessage(err);
				setStatus("idle");
				toast.error(err);
				return;
			}

			const electron = (
				window as unknown as {
					electronAPI?: {
						openExternal?: (url: string) => Promise<boolean>;
					};
				}
			).electronAPI;

			if (electron?.openExternal) {
				await electron.openExternal(res.data.url);
			} else if (typeof window !== "undefined") {
				window.open(res.data.url, "_system") || window.open(res.data.url, "_blank");
			}

			setStatus("restoring");
			setStatusText("Waiting for Google authorization in browser...");

			let pollCount = 0;
			const maxPolls = 60;

			stopPolling();
			pollTimerRef.current = setInterval(async () => {
				pollCount += 1;
				if (pollCount > maxPolls) {
					stopPolling();
					setStatus("idle");
					setErrorMessage("Google authorization timed out. Please try again.");
					toast.error("Google authorization timed out");
					return;
				}

				try {
					const statusRes = await api.get<GoogleRestoreResult | null>(
						"/auth/google/restore-status",
					);
					if (statusRes.success && statusRes.data?.token) {
						stopPolling();
						setStatus("success");
						setStatusText("Restored successfully. Finalizing session...");

						setAuthToken(statusRes.data.token);
						await refreshUser();

						toast.success(
							statusRes.data.summary || "Workspace restored from Google Drive successfully",
						);

						setTimeout(() => {
							handleModalClose();
							router.push("/dashboard");
						}, 1200);
					}
				} catch {
					// Network retry during polling
				}
			}, 2000);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Could not initiate Google restore";
			setErrorMessage(msg);
			setStatus("idle");
			toast.error(msg);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleModalClose}
			title="Restore from Google Drive"
			description="Import your cloud backup from Google Drive and restore your DayPulse workspace."
			maxWidth="md"
		>
			<div className="space-y-4 py-1 sm:py-2">
				{status === "idle" && (
					<>
						<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-6 flex flex-col items-center justify-center text-center">
							<div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2.5 sm:mb-3 shadow-lg shadow-emerald-500/5">
								<Cloud className="w-6 h-6 sm:w-7 sm:h-7" />
							</div>
							<h3 className="text-sm font-semibold text-foreground">Cloud Account Recovery</h3>
							<p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
								DayPulse will securely connect to your Google Drive to locate your backup, verify
								data integrity, and reconstruct your routines, finances, and tasks.
							</p>
						</div>

						{errorMessage && (
							<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 space-y-2.5 text-xs text-red-300">
								<div className="flex items-start gap-2">
									<AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
									<span className="leading-relaxed break-words">{errorMessage}</span>
								</div>
								<div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-500/30">
									{onOpenFileRestore && (
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={() => {
												handleModalClose();
												onOpenFileRestore();
											}}
											className="gap-1.5 text-xs h-8 bg-slate-900 hover:bg-slate-800 text-slate-200"
										>
											<FileArchive className="w-3.5 h-3.5 text-emerald-400" />
											<span>Use File Backup</span>
										</Button>
									)}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setShowConfigForm(!showConfigForm)}
										className="gap-1.5 text-xs h-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
									>
										<KeyRound className="w-3.5 h-3.5" />
										<span>{showConfigForm ? "Hide Credentials" : "Enter Credentials"}</span>
									</Button>
								</div>
							</div>
						)}

						{isConfigured === false && !errorMessage && !isCapacitorNative() && (
							<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-xs text-amber-200/90">
								<div className="flex items-start gap-2">
									<AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
									<p className="leading-relaxed break-words">
										Google Cloud OAuth credentials are not configured yet. You can restore directly
										from a local backup file, or configure your Google Client ID below.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/30">
									{onOpenFileRestore && (
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={() => {
												handleModalClose();
												onOpenFileRestore();
											}}
											className="gap-1.5 text-xs h-8 bg-slate-900 hover:bg-slate-800 text-slate-200"
										>
											<FileArchive className="w-3.5 h-3.5 text-emerald-400" />
											<span>Use File Backup</span>
										</Button>
									)}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setShowConfigForm(!showConfigForm)}
										className="gap-1.5 text-xs h-8 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
									>
										<KeyRound className="w-3.5 h-3.5" />
										<span>{showConfigForm ? "Hide Form" : "Set Google Credentials"}</span>
									</Button>
								</div>
							</div>
						)}

						{(showConfigForm || (isConfigured === false && !isCapacitorNative())) && (
							<form
								onSubmit={handleSaveCredentials}
								className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 sm:p-4 space-y-3"
							>
								<div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
									<KeyRound className="w-4 h-4 text-emerald-400 shrink-0" />
									<span>Configure Google OAuth Credentials</span>
								</div>
								<div className="space-y-1">
									<Label htmlFor="google-client-id" className="text-xs">
										Google Client ID
									</Label>
									<Input
										id="google-client-id"
										placeholder="e.g. 123456789-xxx.apps.googleusercontent.com"
										value={clientIdInput}
										onChange={(e) => setClientIdInput(e.target.value)}
										className="text-xs font-mono break-all h-9"
									/>
								</div>
								<div className="space-y-1">
									<Label htmlFor="google-client-secret" className="text-xs">
										Google Client Secret
									</Label>
									<Input
										id="google-client-secret"
										type="password"
										placeholder="e.g. GOCSPX-xxxxxx"
										value={clientSecretInput}
										onChange={(e) => setClientSecretInput(e.target.value)}
										className="text-xs font-mono break-all h-9"
									/>
								</div>
								<Button
									type="submit"
									variant="emerald"
									size="sm"
									disabled={savingCredentials}
									className="w-full gap-2 text-xs h-9 mt-1"
								>
									<span>{savingCredentials ? "Saving..." : "Save & Connect Google Drive"}</span>
									<ExternalLink className="w-3.5 h-3.5" />
								</Button>
							</form>
						)}

						<div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex items-start gap-2 text-xs text-slate-400">
							<AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
							<p className="leading-relaxed">
								{isCapacitorNative()
									? "A native Google Play Services prompt will open to select your Google Account. No files outside of DayPulse backups are accessed."
									: "A browser window will open for authorization. No Google Drive files outside of DayPulse backups are accessed."}
							</p>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-2 pt-2">
							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={handleModalClose}
									className="text-xs h-8"
								>
									Cancel
								</Button>
								{onOpenFileRestore && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											handleModalClose();
											onOpenFileRestore();
										}}
										className="gap-1.5 text-xs h-8 text-slate-300 hover:text-foreground"
									>
										<FileArchive className="w-3.5 h-3.5 text-emerald-400" />
										<span>File Backup</span>
									</Button>
								)}
							</div>
							<Button
								variant="emerald"
								size="sm"
								onClick={handleStartGoogleRestore}
								className="gap-2 text-xs h-8 w-full sm:w-auto"
							>
								<span>Connect Google Drive</span>
								<ExternalLink className="w-3.5 h-3.5" />
							</Button>
						</div>
					</>
				)}

				{(status === "authorizing" || status === "restoring") && (
					<div className="py-4 sm:py-6 flex flex-col items-center justify-center text-center space-y-4">
						<div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
							<RefreshCw className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-semibold text-slate-200">{statusText}</p>
							<p className="text-xs text-slate-400 max-w-xs leading-relaxed">
								Please complete Google authentication in your browser. DayPulse will automatically
								continue once authorized.
							</p>
						</div>

						<div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2.5 w-full text-left">
							<p className="text-xs text-slate-300 font-medium leading-relaxed">
								If redirected to localhost in your browser, copy the address bar URL or code and
								paste here:
							</p>
							<div className="flex flex-col sm:flex-row items-center gap-2">
								<Input
									placeholder="Paste redirect URL or authorization code..."
									value={authCodeInput}
									onChange={(e) => setAuthCodeInput(e.target.value)}
									className="text-xs font-mono break-all h-9 w-full"
								/>
								<Button
									type="button"
									variant="emerald"
									size="sm"
									disabled={submittingCode || !authCodeInput.trim()}
									onClick={() => handleExchangeCode(authCodeInput)}
									className="w-full sm:w-auto shrink-0 h-9 text-xs"
								>
									{submittingCode ? "Restoring..." : "Complete Restore"}
								</Button>
							</div>
						</div>

						<div className="pt-1">
							<Button variant="ghost" size="sm" onClick={resetState} className="text-xs h-8">
								Cancel
							</Button>
						</div>
					</div>
				)}

				{status === "success" && (
					<div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
						<div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
							<CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-semibold text-emerald-300">Workspace Restored</p>
							<p className="text-xs text-slate-400">{statusText}</p>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}
