"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Layers, LayoutGrid } from "lucide-react";
import * as React from "react";
import { SPRING_GENTLE } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

export interface CardDeckProps<T> {
	items: T[];
	keyExtractor?: (item: T, index: number) => string;
	getKey?: (item: T, index: number) => string;
	getTitle?: (item: T, index: number) => string;
	renderCard: (item: T, index: number) => React.ReactNode;
	renderGrid?: (items: T[]) => React.ReactNode;
	storageKey?: string;
	defaultMode?: "deck" | "grid" | "all";
	title?: string;
	subtitle?: string;
	sectionLabel?: string;
	desktopColumns?: 1 | 2 | 3;
	className?: string;
	emptyState?: React.ReactNode;
	headerActions?: React.ReactNode;
}

export function CardDeck<T>({
	items,
	keyExtractor,
	getKey,
	getTitle,
	renderCard,
	renderGrid,
	storageKey,
	defaultMode = "deck",
	title,
	subtitle,
	sectionLabel,
	desktopColumns = 2,
	className,
	emptyState,
	headerActions,
}: CardDeckProps<T>) {
	const initialMode: "deck" | "grid" = defaultMode === "all" ? "grid" : defaultMode;
	const [viewMode, setViewMode] = React.useState<"deck" | "grid">(initialMode);
	const [currentIndex, setCurrentIndex] = React.useState(0);
	const [direction, setDirection] = React.useState<1 | -1>(1);
	const [isDesktop, setIsDesktop] = React.useState(false);
	const touchStartX = React.useRef<number | null>(null);

	const resolveKey = React.useCallback(
		(item: T, idx: number): string => {
			if (keyExtractor) return keyExtractor(item, idx);
			if (getKey) return getKey(item, idx);
			return String(idx);
		},
		[keyExtractor, getKey],
	);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		if (storageKey) {
			const saved = localStorage.getItem(`daypulse_deck_mode_${storageKey}`);
			if (saved === "deck" || saved === "grid") {
				setViewMode(saved);
			}
		}
		const mq = window.matchMedia("(min-width: 1024px)");
		setIsDesktop(mq.matches);
		const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
		mq.addEventListener("change", listener);
		return () => mq.removeEventListener("change", listener);
	}, [storageKey]);

	const pageSize = isDesktop ? desktopColumns : 1;
	const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
	const safePage = Math.min(Math.floor(currentIndex / pageSize), totalPages - 1);
	const startIdx = safePage * pageSize;
	const visibleItems = items.slice(startIdx, startIdx + pageSize);

	React.useEffect(() => {
		if (currentIndex >= items.length && items.length > 0) {
			setCurrentIndex(Math.max(0, items.length - 1));
		}
	}, [items.length, currentIndex]);

	const handleModeChange = (mode: "deck" | "grid") => {
		setViewMode(mode);
		if (storageKey && typeof window !== "undefined") {
			localStorage.setItem(`daypulse_deck_mode_${storageKey}`, mode);
		}
	};

	const goPrev = React.useCallback(() => {
		setDirection(-1);
		setCurrentIndex((prev) => {
			const next = prev - pageSize;
			return Math.max(next, 0);
		});
	}, [pageSize]);

	const goNext = React.useCallback(() => {
		setDirection(1);
		setCurrentIndex((prev) => {
			const next = prev + pageSize;
			return next >= items.length ? prev : next;
		});
	}, [items.length, pageSize]);

	const goToPage = (pageIndex: number) => {
		const targetIdx = pageIndex * pageSize;
		setDirection(targetIdx >= currentIndex ? 1 : -1);
		setCurrentIndex(targetIdx);
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0]?.clientX ?? null;
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (touchStartX.current === null) return;
		const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
		const diff = touchStartX.current - endX;
		touchStartX.current = null;
		if (Math.abs(diff) < 42) return;
		if (diff > 0 && safePage < totalPages - 1) {
			goNext();
		} else if (diff < 0 && safePage > 0) {
			goPrev();
		}
	};

	if (items.length === 0) {
		return <>{emptyState || null}</>;
	}

	const canPrev = safePage > 0;
	const canNext = safePage < totalPages - 1;
	const activeCardTitle =
		viewMode === "deck" && getTitle && visibleItems[0]
			? getTitle(visibleItems[0], startIdx)
			: undefined;
	const effectiveTitle = title || sectionLabel;

	return (
		<div className={cn("space-y-3.5", className)}>
			{(effectiveTitle || activeCardTitle || headerActions || items.length > 1) && (
				<div className="flex flex-wrap items-center justify-between gap-2.5">
					<div className="min-w-0">
						{effectiveTitle && (
							<h3 className="text-sm sm:text-base font-bold text-foreground">{effectiveTitle}</h3>
						)}
						{(subtitle || activeCardTitle) && (
							<p className="text-xs text-muted-foreground mt-0.5 truncate">
								{activeCardTitle || subtitle}
							</p>
						)}
					</div>

					<div className="flex items-center gap-2 ml-auto">
						{headerActions}

						{viewMode === "deck" && totalPages > 1 && (
							<div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-1">
								<button
									type="button"
									onClick={goPrev}
									disabled={!canPrev}
									className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
									aria-label="Previous card"
								>
									<ChevronLeft className="h-4 w-4" />
								</button>
								<span className="px-1.5 text-xs font-semibold tabular-nums text-foreground">
									{safePage + 1} / {totalPages}
								</span>
								<button
									type="button"
									onClick={goNext}
									disabled={!canNext}
									className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
									aria-label="Next card"
								>
									<ChevronRight className="h-4 w-4" />
								</button>
							</div>
						)}

						{items.length > 1 && (
							<div className="inline-flex items-center rounded-xl border border-border bg-surface p-0.5">
								<button
									type="button"
									onClick={() => handleModeChange("deck")}
									className={cn(
										"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
										viewMode === "deck"
											? "bg-primary-soft text-routine-fg shadow-xs"
											: "text-muted-foreground hover:text-foreground",
									)}
									title="Card Deck View with Previous/Next"
								>
									<Layers className="h-3.5 w-3.5" />
									<span>Cards</span>
								</button>
								<button
									type="button"
									onClick={() => handleModeChange("grid")}
									className={cn(
										"flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
										viewMode === "grid"
											? "bg-primary-soft text-routine-fg shadow-xs"
											: "text-muted-foreground hover:text-foreground",
									)}
									title="All Items View"
								>
									<LayoutGrid className="h-3.5 w-3.5" />
									<span>All ({items.length})</span>
								</button>
							</div>
						)}
					</div>
				</div>
			)}

			{viewMode === "grid" ? (
				<motion.div
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.2 }}
				>
					{renderGrid ? (
						renderGrid(items)
					) : (
						<div
							className={cn(
								"grid gap-4",
								desktopColumns === 1 && "grid-cols-1",
								desktopColumns === 2 && "grid-cols-1 lg:grid-cols-2",
								desktopColumns === 3 && "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
							)}
						>
							{items.map((item, idx) => (
								<div key={resolveKey(item, idx)} className="min-w-0">
									{renderCard(item, idx)}
								</div>
							))}
						</div>
					)}
				</motion.div>
			) : (
				<div
					onTouchStart={handleTouchStart}
					onTouchEnd={handleTouchEnd}
					className="relative select-none"
				>
					<div className="overflow-hidden rounded-2xl">
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={`deck-page-${safePage}-${pageSize}`}
								initial={{ opacity: 0, x: direction * 28 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: direction * -28 }}
								transition={SPRING_GENTLE}
								className={cn(
									"grid gap-4",
									pageSize === 1 && "grid-cols-1",
									pageSize === 2 && "grid-cols-1 lg:grid-cols-2",
									pageSize === 3 && "grid-cols-1 lg:grid-cols-3",
								)}
							>
								{visibleItems.map((item, idx) => {
									const absoluteIdx = startIdx + idx;
									return (
										<div key={resolveKey(item, absoluteIdx)} className="min-w-0">
											{renderCard(item, absoluteIdx)}
										</div>
									);
								})}
							</motion.div>
						</AnimatePresence>
					</div>

					{totalPages > 1 && (
						<div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/90 px-3 py-2 shadow-[var(--shadow-card)]">
							<button
								type="button"
								onClick={goPrev}
								disabled={!canPrev}
								className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-border/60 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
							>
								<ChevronLeft className="h-4 w-4" />
								<span>Previous</span>
							</button>

							<div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
								{totalPages <= 8 ? (
									Array.from({ length: totalPages }).map((_, idx) => {
										const isActive = idx === safePage;
										return (
											<button
												key={`dot-${idx}`}
												type="button"
												onClick={() => goToPage(idx)}
												aria-label={`Go to card ${idx + 1}`}
												className={cn(
													"h-2 rounded-full transition-all duration-200 cursor-pointer",
													isActive
														? "w-6 bg-teal-500"
														: "w-2 bg-border-strong hover:bg-muted-foreground",
												)}
											/>
										);
									})
								) : (
									<span className="text-xs font-bold tabular-nums text-muted-foreground">
										Card {safePage + 1} of {totalPages}
									</span>
								)}
							</div>

							<button
								type="button"
								onClick={goNext}
								disabled={!canNext}
								className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-border/60 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
							>
								<span>Next</span>
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
