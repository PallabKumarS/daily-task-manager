"use client";

import {
	Bell,
	Calendar,
	Check,
	CheckCircle2,
	Info,
	Smartphone,
	Trash2,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import * as React from "react";
import { useNotifications } from "@/components/providers/notification-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
	const [isOpen, setIsOpen] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const {
		notifications,
		unreadCount,
		permission,
		soundEnabled,
		requestPermission,
		toggleSound,
		markAsRead,
		markAllAsRead,
		clearNotifications,
		triggerNotification,
	} = useNotifications();

	React.useEffect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleOutsideClick);
		}
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
		};
	}, [isOpen]);

	const testNotification = () => {
		triggerNotification({
			title: "DayPulse Reminder Alert",
			message:
				"This is a test notification. Audio chime and visual reminders are active.",
			type: "system",
		});
	};

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700 hover:text-white transition"
				aria-label="View notifications"
			>
				<Bell className="w-5 h-5" />
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950 ring-2 ring-slate-950 animate-pulse">
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
					<div className="flex items-center justify-between pb-3 border-b border-slate-800">
						<div className="flex items-center gap-2">
							<span className="text-sm font-bold text-slate-100">
								Notifications
							</span>
							{unreadCount > 0 && (
								<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
									{unreadCount} new
								</span>
							)}
						</div>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={toggleSound}
								className={cn(
									"p-1.5 rounded-lg text-xs transition",
									soundEnabled
										? "text-emerald-400 hover:bg-emerald-500/10"
										: "text-slate-500 hover:bg-slate-800",
								)}
								title={soundEnabled ? "Mute audio chime" : "Enable audio chime"}
							>
								{soundEnabled ? (
									<Volume2 className="w-4 h-4" />
								) : (
									<VolumeX className="w-4 h-4" />
								)}
							</button>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
							>
								<X className="w-4 h-4" />
							</button>
						</div>
					</div>

					{permission !== "granted" && (
						<div className="my-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
								<span className="text-xs text-slate-300">
									Enable OS system alerts
								</span>
							</div>
							<Button
								size="sm"
								variant="default"
								onClick={requestPermission}
								className="h-7 text-xs px-2.5"
							>
								Enable
							</Button>
						</div>
					)}

					<div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-400">
						<button
							type="button"
							onClick={testNotification}
							className="text-emerald-400 hover:underline cursor-pointer"
						>
							Test Alert & Chime
						</button>
						<div className="flex items-center gap-2">
							{unreadCount > 0 && (
								<button
									type="button"
									onClick={markAllAsRead}
									className="hover:text-slate-200 cursor-pointer"
								>
									Mark read
								</button>
							)}
							{notifications.length > 0 && (
								<button
									type="button"
									onClick={clearNotifications}
									className="text-red-400 hover:text-red-300 cursor-pointer"
								>
									Clear all
								</button>
							)}
						</div>
					</div>

					<div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1">
						{notifications.length === 0 ? (
							<div className="py-8 text-center text-xs text-slate-500">
								No notifications right now. You are all caught up.
							</div>
						) : (
							notifications.map((n) => (
								<div
									key={n.id}
									onClick={() => markAsRead(n.id)}
									className={cn(
										"flex items-start gap-3 rounded-xl border p-3 transition cursor-pointer text-left",
										n.read
											? "border-slate-800/40 bg-slate-900/40 text-slate-400"
											: "border-slate-700/60 bg-slate-800/40 text-slate-200 ring-1 ring-emerald-500/20",
									)}
								>
									<div className="mt-0.5 shrink-0">
										{n.type === "event" && (
											<Calendar className="w-4 h-4 text-amber-400" />
										)}
										{n.type === "task" && (
											<CheckCircle2 className="w-4 h-4 text-emerald-400" />
										)}
										{n.type === "routine" && (
											<Smartphone className="w-4 h-4 text-teal-400" />
										)}
										{n.type === "system" && (
											<Info className="w-4 h-4 text-blue-400" />
										)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between">
											<p className="text-xs font-semibold truncate text-slate-200">
												{n.title}
											</p>
											{!n.read && (
												<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
											)}
										</div>
										<p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
											{n.message}
										</p>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
