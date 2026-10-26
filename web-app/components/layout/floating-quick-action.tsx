"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Calculator, CalendarCheck, CheckSquare, Plus, TrendingUp } from "lucide-react";
import * as React from "react";
import { SPRING_GENTLE } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

interface FloatingQuickActionProps {
	onQuickAdd: (type: "routine" | "task" | "transaction" | "tracker" | "alarm") => void;
}

const QUICK_ACTIONS = [
	{
		type: "routine" as const,
		label: "New Routine",
		icon: CalendarCheck,
		iconBoxClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
	},
	{
		type: "task" as const,
		label: "New Task",
		icon: CheckSquare,
		iconBoxClass: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
	},
	{
		type: "alarm" as const,
		label: "New Alarm",
		icon: BellRing,
		iconBoxClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
	},
	{
		type: "tracker" as const,
		label: "New Tracker",
		icon: Calculator,
		iconBoxClass: "bg-purple-500/10 text-purple-500 border-purple-500/20",
	},
	{
		type: "transaction" as const,
		label: "New Money Entry",
		icon: TrendingUp,
		iconBoxClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
	},
];

export function FloatingQuickAction({ onQuickAdd }: FloatingQuickActionProps) {
	const [isOpen, setIsOpen] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleOutsideClick);
			document.addEventListener("keydown", handleKeyDown);
		}
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	return (
		<div ref={containerRef} className="fixed bottom-[136px] md:bottom-6 right-4 sm:right-6 z-40">
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, scale: 0.9, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.9, y: 10 }}
						transition={SPRING_GENTLE}
						className="absolute bottom-full right-0 mb-3 flex flex-col w-52 rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-pop)] backdrop-blur-xl"
					>
						{QUICK_ACTIONS.map((item) => {
							const Icon = item.icon;
							return (
								<button
									key={item.type}
									type="button"
									onClick={() => {
										setIsOpen(false);
										onQuickAdd(item.type);
									}}
									title={`Log ${item.label}`}
									className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 rounded-xl transition cursor-pointer"
								>
									<div
										className={cn(
											"flex h-7 w-7 items-center justify-center rounded-lg border shrink-0",
											item.iconBoxClass,
										)}
									>
										<Icon className="w-3.5 h-3.5 stroke-[2.2]" />
									</div>
									<span className="truncate">{item.label}</span>
								</button>
							);
						})}
					</motion.div>
				)}
			</AnimatePresence>

			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				title={isOpen ? "Close quick menu" : "Quick log new entry"}
				aria-expanded={isOpen}
				className="flex h-12 w-12 sm:w-auto sm:px-4 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/30 items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
			>
				<Plus className={cn("w-5 h-5 transition-transform duration-200", isOpen && "rotate-45")} />
				<span className="hidden sm:inline text-xs font-bold tracking-wide">Quick Log</span>
			</button>
		</div>
	);
}
