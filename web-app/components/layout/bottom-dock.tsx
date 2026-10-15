"use client";

import {
	Calculator,
	CalendarCheck,
	CheckSquare,
	LayoutDashboard,
	Settings,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const DOCK_ITEMS = [
	{ href: "/dashboard", label: "Home", icon: LayoutDashboard },
	{ href: "/routines", label: "Routines", icon: CalendarCheck },
	{ href: "/trackers", label: "Trackers", icon: Calculator },
	{ href: "/tasks", label: "Tasks", icon: CheckSquare },
	{ href: "/finances", label: "Finances", icon: TrendingUp },
	{ href: "/settings", label: "Settings", icon: Settings },
];

export function BottomDock() {
	const pathname = usePathname();

	return (
		<nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/90 backdrop-blur-xl px-1 py-1.5 safe-area-pb">
			<div className="flex items-center justify-around">
				{DOCK_ITEMS.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition duration-150 min-w-[48px]",
								isActive ? "text-teal-300 font-semibold" : "text-slate-400 hover:text-slate-200",
							)}
						>
							<div
								className={cn(
									"p-1 rounded-lg transition",
									isActive && "bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30",
								)}
							>
								<Icon className="w-5 h-5" />
							</div>
							<span className="text-[10px] mt-0.5">{item.label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
