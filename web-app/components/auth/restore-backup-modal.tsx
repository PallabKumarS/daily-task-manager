"use client";

import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	FileArchive,
	Lock,
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
import {
	type BackupArchiveManifest,
	extractManifestFromZip,
	fileToBase64,
} from "@/lib/backup-archive";

interface RestoreBackupModalProps {
	isOpen: boolean;
	onClose: () => void;
}

interface BackupPreviewInfo {
	fileName: string;
	base64Data: string;
	manifest: BackupArchiveManifest | null;
	legacyJson?: Record<string, unknown>;
	estimatedCounts: {
		tasks: number;
		routines: number;
		transactions: number;
		trackers: number;
	};
	accountInfo: {
		name?: string;
		email?: string;
		currency?: string;
	};
}

export function RestoreBackupModal({
	isOpen,
	onClose,
}: RestoreBackupModalProps) {
	const router = useRouter();
	const { refreshUser } = useAuth();

	const [preview, setPreview] = React.useState<BackupPreviewInfo | null>(null);
	const [inspecting, setInspecting] = React.useState(false);
	const [restoring, setRestoring] = React.useState(false);
	const [password, setPassword] = React.useState("");

	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const resetState = () => {
		setPreview(null);
		setInspecting(false);
		setRestoring(false);
		setPassword("");
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleModalClose = () => {
		resetState();
		onClose();
	};

	const processFileBuffer = async (fileName: string, base64Data: string) => {
		setInspecting(true);
		try {
			const isZip =
				fileName.endsWith(".zip") ||
				fileName.endsWith(".daypulse") ||
				base64Data.startsWith("data:application/zip") ||
				base64Data.startsWith("UEsDB"); // PK zip header in base64

			if (isZip) {
				const manifest = await extractManifestFromZip(base64Data);
				if (!manifest) {
					toast.error("Could not read backup manifest from archive.");
					setInspecting(false);
					return;
				}

				setPreview({
					fileName,
					base64Data,
					manifest,
					estimatedCounts: {
						tasks: manifest.counts.tasks || 0,
						routines: manifest.counts.routines || 0,
						transactions: manifest.counts.transactions || 0,
						trackers: manifest.counts.trackers || 0,
					},
					accountInfo: {
						name: manifest.user?.name || "User",
						email: manifest.user?.email,
						currency: manifest.user?.currency || "USD",
					},
				});
			} else {
				// Legacy JSON
				const clean = base64Data.replace(/^data:.*?;base64,/, "").trim();
				const jsonText = atob(clean);
				const parsed = JSON.parse(jsonText);

				const u = parsed.user || {};
				setPreview({
					fileName,
					base64Data,
					manifest: null,
					legacyJson: parsed,
					estimatedCounts: {
						tasks: Array.isArray(parsed.tasks) ? parsed.tasks.length : 0,
						routines: Array.isArray(parsed.routines)
							? parsed.routines.length
							: 0,
						transactions: Array.isArray(parsed.transactions)
							? parsed.transactions.length
							: 0,
						trackers: Array.isArray(parsed.trackers)
							? parsed.trackers.length
							: 0,
					},
					accountInfo: {
						name: u.name || "User",
						email: u.email,
						currency: u.currency || "USD",
					},
				});
			}
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Invalid backup file format";
			toast.error(msg);
		} finally {
			setInspecting(false);
		}
	};

	const handlePickDesktopFile = async () => {
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
				await processFileBuffer(res.fileName, res.base64Data);
			}
		} else {
			fileInputRef.current?.click();
		}
	};

	const handleFileInputChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const base64 = await fileToBase64(file);
		await processFileBuffer(file.name, base64);
	};

	const handleConfirmRestore = async () => {
		if (!preview) return;

		setRestoring(true);
		try {
			const payload: Record<string, unknown> = {
				password: password.trim() || undefined,
			};

			if (preview.manifest) {
				payload.archiveBase64 = preview.base64Data;
			} else if (preview.legacyJson) {
				payload.backup = preview.legacyJson;
			}

			const res = await api.post<{
				user: {
					id: string;
					email: string;
					name: string;
					currency: string;
				};
				token: string;
				summary?: string;
			}>("/auth/restore-backup", payload);

			if (res.success && res.data?.token) {
				setAuthToken(res.data.token);
				await refreshUser();
				toast.success(
					res.message || "Account and workspace restored successfully",
				);
				handleModalClose();
				router.push("/dashboard");
			} else {
				toast.error(res.message || "Failed to restore backup archive");
			}
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "An error occurred during restore";
			toast.error(msg);
		} finally {
			setRestoring(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleModalClose}
			title="Restore from Backup Archive"
			description="Import your complete DayPulse dataset from a compressed ZIP or JSON archive."
			maxWidth="md"
		>
			<input
				ref={fileInputRef}
				type="file"
				accept=".zip,.daypulse,.json,application/zip"
				className="hidden"
				onChange={handleFileInputChange}
			/>

			{!preview ? (
				<div className="space-y-4 py-2">
					<button
						type="button"
						onClick={handlePickDesktopFile}
						className="w-full border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-900/60 group focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
					>
						<div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition mb-3">
							<FileArchive className="w-6 h-6" />
						</div>
						<p className="text-sm font-semibold text-slate-200">
							{inspecting ? "Inspecting archive..." : "Select Backup File"}
						</p>
						<p className="text-xs text-slate-400 mt-1 max-w-xs">
							Supports .zip, .daypulse, or legacy DayPulse backup JSON files.
						</p>
					</button>

					<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex items-start gap-2.5 text-xs text-slate-400">
						<AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
						<p className="leading-relaxed">
							When restoring onto a new device, your local account will be
							automatically recreated with all historical routines, tasks, and
							finance records.
						</p>
					</div>

					<div className="flex justify-end pt-2">
						<Button variant="ghost" onClick={handleModalClose} size="sm">
							Cancel
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-4 py-1">
					{/* Archive Summary Card */}
					<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
						<div className="flex items-center justify-between pb-2 border-b border-slate-800">
							<div className="flex items-center gap-2">
								<CheckCircle2 className="w-4 h-4 text-emerald-400" />
								<span className="text-xs font-bold text-slate-200">
									Verified Backup Archive
								</span>
							</div>
							<span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
								{preview.fileName}
							</span>
						</div>

						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
								<span className="text-slate-400 block text-[10px] uppercase font-semibold">
									Account
								</span>
								<span className="text-slate-200 font-medium truncate block">
									{preview.accountInfo.name}
								</span>
								<span className="text-slate-400 text-[11px] truncate block">
									{preview.accountInfo.email || "No email specified"}
								</span>
							</div>

							<div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
								<span className="text-slate-400 block text-[10px] uppercase font-semibold">
									Currency
								</span>
								<span className="text-slate-200 font-medium">
									{preview.accountInfo.currency}
								</span>
							</div>
						</div>

						<div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
							<div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
								<div className="text-sm font-bold text-emerald-400">
									{preview.estimatedCounts.tasks}
								</div>
								<div className="text-[10px] text-slate-400">Tasks</div>
							</div>
							<div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
								<div className="text-sm font-bold text-teal-400">
									{preview.estimatedCounts.routines}
								</div>
								<div className="text-[10px] text-slate-400">Routines</div>
							</div>
							<div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
								<div className="text-sm font-bold text-cyan-400">
									{preview.estimatedCounts.transactions}
								</div>
								<div className="text-[10px] text-slate-400">Finances</div>
							</div>
							<div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
								<div className="text-sm font-bold text-emerald-400">
									{preview.estimatedCounts.trackers}
								</div>
								<div className="text-[10px] text-slate-400">Trackers</div>
							</div>
						</div>
					</div>

					{/* Optional Password Field */}
					<div className="space-y-1.5">
						<Label htmlFor="restore-password" className="text-xs">
							Account Password (Optional)
						</Label>
						<div className="relative">
							<Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
							<Input
								id="restore-password"
								type="password"
								placeholder="Enter password or leave blank for local session"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="pl-9 text-xs h-10"
							/>
						</div>
						<p className="text-[11px] text-slate-400">
							If you are setting up this account on a new device, you can set an
							optional password for future sign-ins.
						</p>
					</div>

					<div className="flex items-center justify-between pt-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={resetState}
							disabled={restoring}
						>
							Choose Different File
						</Button>

						<Button
							variant="emerald"
							size="sm"
							onClick={handleConfirmRestore}
							disabled={restoring}
							className="gap-2"
						>
							{restoring ? (
								<>
									<RefreshCw className="w-3.5 h-3.5 animate-spin" />
									<span>Restoring...</span>
								</>
							) : (
								<>
									<span>Restore & Sign In</span>
									<ArrowRight className="w-3.5 h-3.5" />
								</>
							)}
						</Button>
					</div>
				</div>
			)}
		</Modal>
	);
}
