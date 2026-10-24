"use client";

import { motion } from "framer-motion";
import { Calculator, CalendarCheck, CheckSquare, LayoutDashboard, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SPRING_SNAPPY } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

const DOCK_ITEMS = [
	{ href: "/dashboard", label: "Today", icon: LayoutDashboard },
	{ href: "/routines", label: "Routines", icon: CalendarCheck },
	{ href: "/tasks", label: "Tasks", icon: CheckSquare },
	{ href: "/trackers", label: "Trackers", icon: Calculator },
	{ href: "/finances", label: "Money", icon: TrendingUp },
];

export function BottomDock() {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Mobile Primary Navigation"
			className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl px-2 py-1.5 safe-area-pb shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
		>
			<div className="grid grid-cols-5 items-center gap-1">
				{DOCK_ITEMS.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"relative flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors duration-150 min-h-[48px]",
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
							<span className="text-xs mt-0.5 leading-tight tracking-tight">{item.label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
