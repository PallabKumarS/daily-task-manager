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
		sm: "max-w-sm sm:max-w-md",
		md: "max-w-md sm:max-w-lg md:max-w-xl",
		lg: "max-w-lg sm:max-w-xl md:max-w-2xl lg:max-w-3xl",
		xl: "max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl",
		"2xl": "max-w-2xl sm:max-w-3xl md:max-w-4xl lg:max-w-5xl",
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8">
			<div
				className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in"
				onClick={onClose}
				aria-hidden="true"
			/>

			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
				className={cn(
					"relative w-full rounded-3xl border border-slate-700/80 bg-slate-900/95 p-6 sm:p-7 md:p-8 shadow-2xl shadow-black/80 z-10 max-h-[94vh] sm:max-h-[90vh] md:max-h-[86vh] flex flex-col backdrop-blur-2xl animate-in zoom-in-95 duration-200",
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
