"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	BellRing,
	Calculator,
	CalendarCheck,
	CheckSquare,
	DollarSign,
	Plus,
	RefreshCw,
} from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { SPRING_SNAPPY } from "@/lib/motion-tokens";

const ContextDockValueContext = React.createContext<React.ReactNode | null>(null);
const ContextDockDispatchContext = React.createContext<(node: React.ReactNode | null) => void>(
	() => {},
);

export function ContextDockProvider({ children }: { children: React.ReactNode }) {
	const [customSlot, setCustomSlot] = React.useState<React.ReactNode | null>(null);
	return (
		<ContextDockDispatchContext.Provider value={setCustomSlot}>
			<ContextDockValueContext.Provider value={customSlot}>
				{children}
			</ContextDockValueContext.Provider>
		</ContextDockDispatchContext.Provider>
	);
}

export function useContextDockSlot(): React.ReactNode | null {
	return React.useContext(ContextDockValueContext);
}

export function useContextDock(node?: React.ReactNode) {
	const setCustomSlot = React.useContext(ContextDockDispatchContext);

	React.useEffect(() => {
		if (node === undefined) return;
		setCustomSlot(node);
		return () => setCustomSlot(null);
	}, [node, setCustomSlot]);

	return React.useMemo(() => ({ setCustomSlot }), [setCustomSlot]);
}

interface MobileContextDockProps {
	onQuickAdd: (type: "routine" | "task" | "transaction" | "tracker" | "alarm") => void;
	onRefresh: () => void;
}

export function MobileContextDock({ onQuickAdd, onRefresh }: MobileContextDockProps) {
	const pathname = usePathname();
	const customSlot = useContextDockSlot();
	const [isVisible, setIsVisible] = React.useState(true);
	const [isModalOpen, setIsModalOpen] = React.useState(false);
	const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);
	const lastScrollY = React.useRef(0);

	React.useEffect(() => {
		let rafId: number | null = null;
		const handleScroll = () => {
			if (rafId !== null) return;
			rafId = window.requestAnimationFrame(() => {
				const currentY = window.scrollY;
				const delta = currentY - lastScrollY.current;
				if (currentY < 32) {
					setIsVisible(true);
				} else if (delta > 14) {
					setIsVisible(false);
				} else if (delta < -10) {
					setIsVisible(true);
				}
				lastScrollY.current = currentY;
				rafId = null;
			});
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			if (rafId !== null) window.cancelAnimationFrame(rafId);
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	React.useEffect(() => {
		const handleModalChange = (e: Event) => {
			const detail = (e as CustomEvent<{ open: boolean }>).detail;
			setIsModalOpen(Boolean(detail?.open));
		};
		window.addEventListener("daypulse:modal-change", handleModalChange);
		return () => window.removeEventListener("daypulse:modal-change", handleModalChange);
	}, []);

	React.useEffect(() => {
		if (typeof window === "undefined" || !window.visualViewport) return;
		const vv = window.visualViewport;
		const handleResize = () => {
			const shrunk = vv.height < window.innerHeight * 0.78;
			setIsKeyboardOpen(shrunk);
		};
		vv.addEventListener("resize", handleResize);
		return () => vv.removeEventListener("resize", handleResize);
	}, []);

	if (pathname.startsWith("/settings")) {
		return null;
	}

	const shouldShow = isVisible && !isModalOpen && !isKeyboardOpen;

	const renderDefaultActions = () => {
		if (pathname.startsWith("/routines")) {
			return (
				<div className="flex items-center justify-between gap-2 w-full">
					<span className="text-xs font-semibold text-muted-foreground pl-2 truncate">
						Daily Habits & Slots
					</span>
					<button
						type="button"
						onClick={() => onQuickAdd("routine")}
						className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>Add Routine</span>
					</button>
				</div>
			);
		}

		if (pathname.startsWith("/tasks")) {
			return (
				<div className="flex items-center justify-between gap-2 w-full">
					<button
						type="button"
						onClick={() => onQuickAdd("alarm")}
						className="inline-flex items-center gap-1.5 rounded-xl bg-alarm-soft border border-amber-500/30 px-3 py-2 text-xs font-semibold text-alarm-fg cursor-pointer"
					>
						<BellRing className="w-3.5 h-3.5" />
						<span>New Alarm</span>
					</button>
					<button
						type="button"
						onClick={() => onQuickAdd("task")}
						className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>Add Task</span>
					</button>
				</div>
			);
		}

		if (pathname.startsWith("/trackers")) {
			return (
				<div className="flex items-center justify-between gap-2 w-full">
					<span className="text-xs font-semibold text-muted-foreground pl-2 truncate">
						Daily Unit Counters
					</span>
					<button
						type="button"
						onClick={() => onQuickAdd("tracker")}
						className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>New Tracker</span>
					</button>
				</div>
			);
		}

		if (pathname.startsWith("/finances")) {
			return (
				<div className="flex items-center justify-between gap-1 w-full">
					<span className="text-xs font-semibold text-muted-foreground truncate">
						Cashflow & Debts
					</span>
					<button
						type="button"
						onClick={() => onQuickAdd("transaction")}
						className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm cursor-pointer"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>Entry</span>
					</button>
				</div>
			);
		}

		return (
			<div className="flex items-center justify-between gap-1.5 w-full overflow-x-auto no-scrollbar">
				<button
					type="button"
					onClick={() => onQuickAdd("routine")}
					className="inline-flex items-center gap-1.5 rounded-xl bg-routine-soft px-2.5 py-1.5 text-xs font-semibold text-routine-fg shrink-0 cursor-pointer"
				>
					<CalendarCheck className="w-3.5 h-3.5" />
					<span>Habit</span>
				</button>
				<button
					type="button"
					onClick={() => onQuickAdd("task")}
					className="inline-flex items-center gap-1.5 rounded-xl bg-task-soft px-2.5 py-1.5 text-xs font-semibold text-task-fg shrink-0 cursor-pointer"
				>
					<CheckSquare className="w-3.5 h-3.5" />
					<span>Task</span>
				</button>
				<button
					type="button"
					onClick={() => onQuickAdd("tracker")}
					className="inline-flex items-center gap-1.5 rounded-xl bg-tracker-soft px-2.5 py-1.5 text-xs font-semibold text-tracker-fg shrink-0 cursor-pointer"
				>
					<Calculator className="w-3.5 h-3.5" />
					<span>Tracker</span>
				</button>
				<button
					type="button"
					onClick={() => onQuickAdd("transaction")}
					className="inline-flex items-center gap-1.5 rounded-xl bg-income-soft px-2.5 py-1.5 text-xs font-semibold text-income-fg shrink-0 cursor-pointer"
				>
					<DollarSign className="w-3.5 h-3.5" />
					<span>Spend</span>
				</button>
				<button
					type="button"
					onClick={onRefresh}
					className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
					title="Refresh"
				>
					<RefreshCw className="w-3.5 h-3.5" />
				</button>
			</div>
		);
	};

	return (
		<AnimatePresence>
			{shouldShow && (
				<motion.div
					initial={{ opacity: 0, y: 28, scale: 0.96 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 28, scale: 0.96 }}
					transition={SPRING_SNAPPY}
					className="md:hidden fixed left-3 right-3 bottom-[calc(var(--bottom-nav-h,64px)+10px)] z-30 flex items-center rounded-2xl border border-border-strong bg-surface/95 px-2.5 py-2 shadow-(--shadow-pop) backdrop-blur-xl"
				>
					{customSlot || renderDefaultActions()}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
