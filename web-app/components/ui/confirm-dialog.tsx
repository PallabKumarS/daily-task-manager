"use client";

import { AlertTriangle, HelpCircle, Trash2, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "destructive" | "default" | "warning";

export interface ConfirmOptions {
	title: string;
	description?: string;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmVariant;
}

export interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	description?: string;
	confirmText?: string;
	cancelText?: string;
	variant?: ConfirmVariant;
	isLoading?: boolean;
	onConfirm: () => void | Promise<void>;
	onCancel: () => void;
}

export function ConfirmDialog({
	isOpen,
	title,
	description,
	confirmText,
	cancelText = "Cancel",
	variant = "default",
	isLoading = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const defaultConfirmText = variant === "destructive" ? "Delete" : "Confirm";
	const actionText = confirmText || defaultConfirmText;

	React.useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCancel();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen, onCancel]);

	if (!isOpen) return null;

	const getIcon = () => {
		switch (variant) {
			case "destructive":
				return (
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-sm">
						<Trash2 className="h-5 w-5" />
					</div>
				);
			case "warning":
				return (
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm">
						<AlertTriangle className="h-5 w-5" />
					</div>
				);
			default:
				return (
					<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
						<HelpCircle className="h-5 w-5" />
					</div>
				);
		}
	};

	const getConfirmButtonVariant = () => {
		switch (variant) {
			case "destructive":
				return "destructive";
			case "warning":
				return "default";
			default:
				return "emerald";
		}
	};

	return (
		<div className="fixed inset-0 z-[70] flex justify-center p-4 pb-12 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-slate-950/70 transition-opacity animate-in fade-in duration-150"
				onClick={onCancel}
				aria-hidden="true"
			/>

			{/* Modal Dialog Card */}
			<div
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="confirm-dialog-title"
				aria-describedby={description ? "confirm-dialog-description" : undefined}
				className={cn(
					"relative w-full max-w-lg my-auto rounded-3xl border border-slate-700/80 bg-slate-900 p-6 sm:p-7 shadow-2xl shadow-black/90 z-10 flex flex-col animate-in zoom-in-95 duration-200",
				)}
			>
				<button
					type="button"
					onClick={onCancel}
					className="absolute top-4 right-4 rounded-xl p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
					aria-label="Close dialog"
				>
					<X className="w-4 h-4" />
				</button>

				<div className="flex items-start gap-4">
					{getIcon()}
					<div className="min-w-0 flex-1 pt-0.5">
						<h3
							id="confirm-dialog-title"
							className="text-base font-bold text-slate-100 leading-snug"
						>
							{title}
						</h3>
						{description && (
							<p
								id="confirm-dialog-description"
								className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed"
							>
								{description}
							</p>
						)}
					</div>
				</div>

				<div className="mt-6 flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onCancel}
						disabled={isLoading}
						className="px-4 text-xs font-semibold text-slate-300 hover:text-white"
					>
						{cancelText}
					</Button>
					<Button
						type="button"
						variant={getConfirmButtonVariant()}
						size="sm"
						onClick={onConfirm}
						disabled={isLoading}
						className="px-5 text-xs font-semibold"
					>
						{isLoading ? "Processing..." : actionText}
					</Button>
				</div>
			</div>
		</div>
	);
}

interface ConfirmContextValue {
	confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
	const [dialogState, setDialogState] = React.useState<{
		isOpen: boolean;
		options: ConfirmOptions;
		resolve?: (value: boolean) => void;
	}>({
		isOpen: false,
		options: { title: "" },
	});

	const confirm = React.useCallback((options: ConfirmOptions) => {
		return new Promise<boolean>((resolve) => {
			setDialogState({
				isOpen: true,
				options,
				resolve,
			});
		});
	}, []);

	const handleConfirm = () => {
		dialogState.resolve?.(true);
		setDialogState((prev) => ({ ...prev, isOpen: false }));
	};

	const handleCancel = () => {
		dialogState.resolve?.(false);
		setDialogState((prev) => ({ ...prev, isOpen: false }));
	};

	return (
		<ConfirmContext.Provider value={{ confirm }}>
			{children}
			<ConfirmDialog
				isOpen={dialogState.isOpen}
				title={dialogState.options.title}
				description={dialogState.options.description}
				confirmText={dialogState.options.confirmText}
				cancelText={dialogState.options.cancelText}
				variant={dialogState.options.variant}
				onConfirm={handleConfirm}
				onCancel={handleCancel}
			/>
		</ConfirmContext.Provider>
	);
}

export function useConfirm() {
	const context = React.useContext(ConfirmContext);
	if (!context) {
		throw new Error("useConfirm must be used within a ConfirmProvider");
	}
	return context.confirm;
}
