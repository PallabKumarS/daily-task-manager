"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	description?: string;
	children: React.ReactNode;
	maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
	className?: string;
}

export function Modal({
	isOpen,
	onClose,
	title,
	description,
	children,
	maxWidth = "lg",
	className,
}: ModalProps) {
	React.useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const maxWidthClasses = {
		sm: "max-w-md sm:max-w-lg w-full",
		md: "max-w-lg sm:max-w-xl md:max-w-2xl w-full",
		lg: "max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl w-full",
		xl: "max-w-2xl sm:max-w-3xl md:max-w-4xl lg:max-w-5xl w-full",
		"2xl": "max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl w-full",
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8">
			{/* Non-blurring dark overlay to keep background window visible */}
			<div
				className="fixed inset-0 bg-slate-950/70 transition-opacity animate-in fade-in duration-150"
				onClick={onClose}
				aria-hidden="true"
			/>

			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
				className={cn(
					"relative w-full rounded-3xl border border-slate-700/80 bg-slate-900 p-6 sm:p-7 md:p-8 shadow-2xl shadow-black/90 z-10 max-h-[92vh] sm:max-h-[90vh] md:max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-200",
					maxWidthClasses[maxWidth],
					className,
				)}
			>
				<div className="flex items-start justify-between pb-4 sm:pb-5 border-b border-slate-800 shrink-0">
					<div>
						<h2
							id="modal-title"
							className="text-lg sm:text-xl font-bold text-slate-100"
						>
							{title}
						</h2>
						{description && (
							<p className="text-xs sm:text-sm text-slate-400 mt-1">
								{description}
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
						aria-label="Close modal"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="pt-4 sm:pt-5 pb-2 px-1.5 sm:px-2 overflow-y-auto flex-1">
					{children}
				</div>
			</div>
		</div>
	);
}
