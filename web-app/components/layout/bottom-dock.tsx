"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavTabs } from "@/components/providers/nav-tabs-provider";
import { SPRING_SNAPPY } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

const GRID_COLS_MAP: Record<number, string> = {
	1: "grid-cols-1 max-w-xs mx-auto",
	2: "grid-cols-2",
	3: "grid-cols-3",
	4: "grid-cols-4",
	5: "grid-cols-5",
};

export function BottomDock() {
	const pathname = usePathname();
	const { visibleNavTabs } = useNavTabs();

	const gridClass = GRID_COLS_MAP[visibleNavTabs.length] || "grid-cols-5";

	return (
		<nav
			aria-label="Mobile Primary Navigation"
			className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl px-2 py-1.5 safe-area-pb shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
		>
			<div className={cn("grid items-center gap-1", gridClass)}>
				{visibleNavTabs.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors duration-150 min-h-12",
								isActive
									? "text-routine-fg font-bold"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{isActive && (
								<motion.div
									layoutId="mobile-bottom-nav-pill"
									transition={SPRING_SNAPPY}
									className="absolute inset-x-1.5 top-0.5 bottom-0.5 rounded-xl bg-primary-soft border border-teal-500/25 -z-10"
								/>
							)}
							<Icon
								className={cn(
									"w-5 h-5 transition-transform duration-200",
									isActive && "scale-105 text-teal-600 dark:text-teal-400",
								)}
							/>
							<span className="text-xs mt-0.5 leading-tight tracking-tight">{item.shortLabel}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
