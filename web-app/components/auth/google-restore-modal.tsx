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
import { api, setAuthToken } from "@/lib/api-client";

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
	}, [stopPolling]);

	const handleModalClose = () => {
		resetState();
		onClose();
	};

	React.useEffect(() => {
		return () => {
			stopPolling();
		};
	}, [stopPolling]);

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

	const handleStartGoogleRestore = async () => {
		setErrorMessage(null);
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
			const maxPolls = 60; // 2 minutes max

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
					// Network hiccup while polling; ignore and retry next interval
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
			<div className="space-y-4 py-2">
				{status === "idle" && (
					<>
						<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 flex flex-col items-center justify-center text-center">
							<div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/5">
								<Cloud className="w-7 h-7" />
							</div>
							<h3 className="text-sm font-semibold text-white">Cloud Account Recovery</h3>
							<p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
								DayPulse will securely connect to your Google Drive to locate your encrypted backup,
								verify data integrity, and reconstruct your routines, finances, and tasks.
							</p>
						</div>

						{errorMessage && (
							<div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3.5 space-y-2.5 text-xs text-red-300">
								<div className="flex items-start gap-2.5">
									<AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
									<span className="leading-relaxed">{errorMessage}</span>
								</div>
								<div className="flex items-center gap-2 pt-1 border-t border-red-900/40">
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
											<span>Restore from Local File Backup Instead</span>
										</Button>
									)}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setShowConfigForm(!showConfigForm)}
										className="gap-1.5 text-xs h-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30"
									>
										<KeyRound className="w-3.5 h-3.5" />
										<span>{showConfigForm ? "Hide Credentials" : "Enter Credentials"}</span>
									</Button>
								</div>
							</div>
						)}

						{isConfigured === false && !errorMessage && (
							<div className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-3.5 space-y-2 text-xs text-amber-200/90">
								<div className="flex items-start gap-2.5">
									<AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
									<p className="leading-relaxed">
										Google Cloud OAuth credentials are not configured yet. You can restore directly
										from a local backup file, or configure your Google Client ID below.
									</p>
								</div>
								<div className="flex items-center gap-2 pt-1 border-t border-amber-900/30">
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
											<span>Use File Backup (.zip / .json)</span>
										</Button>
									)}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setShowConfigForm(!showConfigForm)}
										className="gap-1.5 text-xs h-8 text-amber-300 hover:text-amber-200 hover:bg-amber-950/30"
									>
										<KeyRound className="w-3.5 h-3.5" />
										<span>{showConfigForm ? "Hide Form" : "Set Google Credentials"}</span>
									</Button>
								</div>
							</div>
						)}

						{showConfigForm && (
							<form
								onSubmit={handleSaveCredentials}
								className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3"
							>
								<div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
									<KeyRound className="w-4 h-4 text-emerald-400" />
									<span>Configure Google OAuth Credentials</span>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="google-client-id">Google Client ID</Label>
									<Input
										id="google-client-id"
										placeholder="e.g. 123456789-xxx.apps.googleusercontent.com"
										value={clientIdInput}
										onChange={(e) => setClientIdInput(e.target.value)}
										className="text-xs"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="google-client-secret">Google Client Secret</Label>
									<Input
										id="google-client-secret"
										type="password"
										placeholder="e.g. GOCSPX-xxxxxx"
										value={clientSecretInput}
										onChange={(e) => setClientSecretInput(e.target.value)}
										className="text-xs"
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

						<div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 flex items-start gap-2.5 text-xs text-slate-400">
							<AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
							<p className="leading-relaxed">
								A browser window will open for authorization. No Google Drive files outside of
								DayPulse backups are accessed.
							</p>
						</div>

						<div className="flex items-center justify-between pt-2">
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="sm" onClick={handleModalClose}>
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
										className="gap-1.5 text-xs text-slate-300 hover:text-white"
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
								className="gap-2"
							>
								<span>Connect Google Drive</span>
								<ExternalLink className="w-3.5 h-3.5" />
							</Button>
						</div>
					</>
				)}

				{(status === "authorizing" || status === "restoring") && (
					<div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
						<div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
							<RefreshCw className="w-7 h-7 animate-spin" />
						</div>
						<div className="space-y-1">
							<p className="text-sm font-semibold text-slate-200">{statusText}</p>
							<p className="text-xs text-slate-400 max-w-xs leading-relaxed">
								Please complete the Google authentication prompt in your browser tab. DayPulse will
								automatically continue once authorized.
							</p>
						</div>

						<div className="pt-2">
							<Button variant="ghost" size="sm" onClick={resetState}>
								Cancel
							</Button>
						</div>
					</div>
				)}

				{status === "success" && (
					<div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
						<div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
							<CheckCircle2 className="w-7 h-7" />
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
