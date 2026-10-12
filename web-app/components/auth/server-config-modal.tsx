"use client";

import { CheckCircle2, Globe, Laptop, RefreshCw, Server, Wifi, XCircle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	getApiBaseUrl,
	isCapacitorNative,
	normalizeServerUrl,
	setApiBaseUrl,
	testServerConnection,
} from "@/lib/api-client";

interface ServerConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSaved?: () => void;
}

export function ServerConfigModal({ isOpen, onClose, onSaved }: ServerConfigModalProps) {
	const [serverUrl, setServerUrl] = React.useState("");
	const [testing, setTesting] = React.useState(false);
	const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);

	React.useEffect(() => {
		if (isOpen) {
			const current = getApiBaseUrl();
			setServerUrl(current);
			setTestResult(null);
		}
	}, [isOpen]);

	const handleTestConnection = async () => {
		if (!serverUrl.trim()) {
			toast.error("Please enter a server address first.");
			return;
		}

		setTesting(true);
		setTestResult(null);
		try {
			const res = await testServerConnection(serverUrl);
			setTestResult(res);
			if (res.ok) {
				toast.success(res.message);
			} else {
				toast.error(res.message);
			}
		} finally {
			setTesting(false);
		}
	};

	const handleSave = () => {
		const trimmed = serverUrl.trim();
		if (!trimmed) {
			setApiBaseUrl("");
			toast.success("Reset server URL to default");
		} else {
			const normalized = normalizeServerUrl(trimmed);
			setApiBaseUrl(normalized);
			toast.success("Server connection updated");
		}
		onSaved?.();
		onClose();
	};

	const handleQuickPreset = (preset: string) => {
		setServerUrl(preset);
		setTestResult(null);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Server Connection"
			description="Configure the DayPulse API server address for synchronized data."
			maxWidth="md"
		>
			<div className="space-y-4 py-2">
				<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
					<div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
						<Server className="w-4 h-4" />
						<span>Target API Server</span>
					</div>
					<p className="text-xs text-slate-400 leading-relaxed">
						{isCapacitorNative()
							? "On mobile, enter the local IP address of your PC running DayPulse Desktop (e.g. http://192.168.1.5:49275) or your hosted backend."
							: "DayPulse connects to this API endpoint to synchronize tasks, routines, and wealth ledger data."}
					</p>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="server-url">Server URL</Label>
					<div className="relative">
						<Globe className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
						<Input
							id="server-url"
							type="text"
							placeholder="http://192.168.1.100:49275"
							value={serverUrl}
							onChange={(e) => {
								setServerUrl(e.target.value);
								setTestResult(null);
							}}
							className="pl-9 font-mono text-xs"
						/>
					</div>
				</div>

				<div className="space-y-2">
					<span className="text-xs text-slate-400 font-medium">Quick Presets</span>
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => handleQuickPreset("http://192.168.1.100:49275")}
							className="text-[11px] h-8 justify-start gap-1.5 border-slate-800 bg-slate-900/40 text-slate-300 hover:text-white"
						>
							<Laptop className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
							<span className="truncate">Desktop LAN (:49275)</span>
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => handleQuickPreset("http://localhost:5000")}
							className="text-[11px] h-8 justify-start gap-1.5 border-slate-800 bg-slate-900/40 text-slate-300 hover:text-white"
						>
							<Wifi className="w-3.5 h-3.5 text-teal-400 shrink-0" />
							<span className="truncate">Dev Server (:5000)</span>
						</Button>
					</div>
				</div>

				{testResult && (
					<div
						className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs ${
							testResult.ok
								? "border-emerald-900/50 bg-emerald-950/20 text-emerald-300"
								: "border-red-900/50 bg-red-950/20 text-red-300"
						}`}
					>
						{testResult.ok ? (
							<CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
						) : (
							<XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
						)}
						<span className="leading-relaxed">{testResult.message}</span>
					</div>
				)}

				<div className="flex items-center justify-between pt-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleTestConnection}
						disabled={testing}
						className="gap-1.5 text-xs h-9 border-slate-800 bg-slate-900/60"
					>
						<RefreshCw
							className={`w-3.5 h-3.5 ${testing ? "animate-spin text-emerald-400" : ""}`}
						/>
						<span>{testing ? "Testing..." : "Test Connection"}</span>
					</Button>

					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onClose}
							className="text-xs h-9"
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="emerald"
							size="sm"
							onClick={handleSave}
							className="text-xs h-9"
						>
							Save & Connect
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
}
