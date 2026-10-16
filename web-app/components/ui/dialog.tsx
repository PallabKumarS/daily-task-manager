"use client";

import { X } from "lucide-react";
import * as React from "react";
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

		const handleFocusIn = (e: FocusEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
			) {
				setTimeout(() => {
					target.scrollIntoView({ block: "nearest", behavior: "smooth" });
				}, 150);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("focusin", handleFocusIn);
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("focusin", handleFocusIn);
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
		<div className="fixed inset-0 z-50 flex justify-center p-3 pb-12 sm:p-6 md:p-8 overflow-y-auto bg-slate-950/85 backdrop-blur-sm">
			<div
				className="fixed inset-0 bg-slate-950/85 transition-opacity animate-in fade-in duration-150"
				onClick={onClose}
				aria-hidden="true"
			/>

			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="modal-title"
				className={cn(
					"relative w-full my-auto rounded-3xl border border-slate-700/80 bg-slate-900 p-5 sm:p-7 md:p-8 shadow-2xl shadow-black/90 z-10 animate-in zoom-in-95 duration-200",
					maxWidthClasses[maxWidth],
					className,
				)}
			>
				<div className="flex items-start justify-between pb-3 sm:pb-5 border-b border-slate-800 shrink-0">
					<div className="min-w-0 pr-2">
						<h2 id="modal-title" className="text-base sm:text-xl font-bold text-slate-100 truncate">
							{title}
						</h2>
						{description && (
							<p className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1 leading-relaxed">
								{description}
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer shrink-0"
						aria-label="Close modal"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="pt-3 sm:pt-4">{children}</div>
			</div>
		</div>
	);
}
