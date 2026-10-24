"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import * as React from "react";
import { SPRING_GENTLE } from "@/lib/motion-tokens";
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
		document.documentElement.setAttribute("data-modal-open", "true");
		window.dispatchEvent(new CustomEvent("daypulse:modal-change", { detail: { open: true } }));

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("focusin", handleFocusIn);
			document.body.style.overflow = originalOverflow;
			document.documentElement.removeAttribute("data-modal-open");
			window.dispatchEvent(new CustomEvent("daypulse:modal-change", { detail: { open: false } }));
		};
	}, [isOpen, onClose]);

	const maxWidthClasses = {
		sm: "max-w-md sm:max-w-lg w-full",
		md: "max-w-lg sm:max-w-xl md:max-w-2xl w-full",
		lg: "max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl w-full",
		xl: "max-w-2xl sm:max-w-3xl md:max-w-4xl lg:max-w-5xl w-full",
		"2xl": "max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl w-full",
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-50 flex justify-center p-3 pb-12 sm:p-6 md:p-8 overflow-y-auto">
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18 }}
						className="fixed inset-0 bg-backdrop backdrop-blur-sm"
						onClick={onClose}
						aria-hidden="true"
					/>

					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby="modal-title"
						initial={{ opacity: 0, scale: 0.96, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 12 }}
						transition={SPRING_GENTLE}
						className={cn(
							"relative w-full my-auto rounded-3xl border border-border-strong bg-surface p-5 sm:p-7 md:p-8 shadow-[var(--shadow-pop)] z-10",
							maxWidthClasses[maxWidth],
							className,
						)}
					>
						<div className="flex items-start justify-between pb-3 sm:pb-5 border-b border-border shrink-0">
							<div className="min-w-0 pr-2">
								<h2
									id="modal-title"
									className="text-base sm:text-xl font-bold text-foreground truncate"
								>
									{title}
								</h2>
								{description && (
									<p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 leading-relaxed">
										{description}
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={onClose}
								className="rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition cursor-pointer shrink-0"
								aria-label="Close modal"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="pt-3 sm:pt-4">{children}</div>
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
}
