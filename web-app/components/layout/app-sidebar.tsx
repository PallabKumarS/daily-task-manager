"use client";

import { motion } from "framer-motion";
import { Activity, LogOut, Monitor, Moon, Settings, SlidersHorizontal, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useNavTabs } from "@/components/providers/nav-tabs-provider";
import { type ThemePreference, useTheme } from "@/components/providers/theme-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SPRING_SNAPPY } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
	{ value: "system", label: "Auto", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
];

export function AppSidebar() {
	const pathname = usePathname();
	const { user, logout } = useAuth();
	const { visibleNavTabs, setCustomizeOpen } = useNavTabs();
	const { preference, setPreference } = useTheme();
	const confirm = useConfirm();

	const handleLogout = async () => {
		const ok = await confirm({
			title: "Sign Out",
			description: "Are you sure you want to sign out of DayPulse?",
			confirmText: "Sign Out",
			variant: "default",
		});
		if (ok) {
			await logout();
		}
	};

	const isSettingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

	return (
		<aside className="hidden md:flex flex-col w-64 h-[calc(100vh-var(--titlebar-height,0px))] max-h-[calc(100vh-var(--titlebar-height,0px))] sticky top-[var(--titlebar-height,0px)] border-r border-border bg-surface/90 p-4 shrink-0 select-none overflow-hidden transition-[top,height] duration-150">
			<div className="flex items-center gap-3 px-2 py-1 mb-5 shrink-0">
				<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 text-white shadow-md shadow-teal-500/20 shrink-0">
					<Activity className="w-5 h-5 stroke-[2.5]" />
				</div>
				<div className="min-w-0">
					<div className="flex items-center gap-1.5">
						<span className="text-base font-extrabold tracking-tight text-foreground">
							DayPulse
						</span>
						<span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
					</div>
					<p className="text-xs text-muted-foreground font-medium truncate">
						Habits, Agenda & Cashflow
					</p>
				</div>
			</div>

			<div className="flex items-center justify-between px-2 mb-2 shrink-0">
				<span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
					Workspace
				</span>
				<button
					type="button"
					onClick={() => setCustomizeOpen(true)}
					className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 hover:bg-surface-2 transition cursor-pointer"
					title="Customize navigation tabs"
				>
					<SlidersHorizontal className="w-3 h-3" />
					<span>Edit</span>
				</button>
			</div>

			<nav className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
				{visibleNavTabs.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
								isActive
									? "text-routine-fg font-semibold"
									: "text-muted-foreground hover:text-foreground hover:bg-surface-2/80",
							)}
						>
							{isActive && (
								<motion.div
									layoutId="desktop-sidebar-active"
									transition={SPRING_SNAPPY}
									className="absolute inset-0 rounded-xl bg-primary-soft border border-teal-500/25 -z-10"
								/>
							)}
							<Icon
								className={cn(
									"w-4 h-4 shrink-0",
									isActive ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground",
								)}
							/>
							<span className="truncate">{item.label}</span>
						</Link>
					);
				})}

				<div className="pt-2 mt-2 border-t border-border/50">
					<Link
						href="/settings"
						className={cn(
							"relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
							isSettingsActive
								? "text-routine-fg font-semibold"
								: "text-muted-foreground hover:text-foreground hover:bg-surface-2/80",
						)}
					>
						{isSettingsActive && (
							<motion.div
								layoutId="desktop-sidebar-active"
								transition={SPRING_SNAPPY}
								className="absolute inset-0 rounded-xl bg-primary-soft border border-teal-500/25 -z-10"
							/>
						)}
						<Settings
							className={cn(
								"w-4 h-4 shrink-0",
								isSettingsActive ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground",
							)}
						/>
						<span className="truncate">Settings</span>
					</Link>
				</div>
			</nav>

			<div className="shrink-0 mt-auto pt-3 space-y-3 border-t border-border">
				<div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-2/80 p-1">
					{THEME_OPTIONS.map((opt) => {
						const Icon = opt.icon;
						const active = preference === opt.value;
						return (
							<button
								key={opt.value}
								type="button"
								onClick={() => setPreference(opt.value)}
								className={cn(
									"flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer",
									active
										? "bg-surface text-foreground shadow-xs border border-border"
										: "text-muted-foreground hover:text-foreground",
								)}
								title={`Theme: ${opt.label}`}
							>
								<Icon className="w-3.5 h-3.5" />
								<span>{opt.label}</span>
							</button>
						);
					})}
				</div>

				{user && (
					<div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-2/70 border border-border">
						<div className="min-w-0 pr-2">
							<p className="text-xs font-bold text-foreground truncate">{user.name}</p>
							<p className="text-xs text-muted-foreground truncate">{user.email}</p>
						</div>
						<button
							type="button"
							onClick={handleLogout}
							className="p-2 rounded-lg text-muted-foreground hover:text-expense-fg hover:bg-expense-soft transition cursor-pointer shrink-0"
							title="Sign Out"
						>
							<LogOut className="w-4 h-4" />
						</button>
					</div>
				)}

				<div className="flex items-center justify-between text-[11px] text-subtle px-1 pt-0.5 font-mono">
					<span>DayPulse</span>
					<span className="rounded-md bg-surface-2 px-1.5 py-0.5 border border-border text-[10px] font-semibold text-muted-foreground">
						v2.0.0
					</span>
				</div>
			</div>
		</aside>
	);
}
