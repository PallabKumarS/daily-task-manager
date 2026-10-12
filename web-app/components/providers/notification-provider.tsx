"use client";

import * as React from "react";
import { toast } from "sonner";
import { parseAlarmConfig } from "@/lib/alarm-settings";
import { api, getAuthToken } from "@/lib/api-client";
import { playNotificationChime, stopCurrentAlarm } from "@/lib/audio-chime";
import {
	dispatchUnifiedAlarm,
	requestPlatformNotificationPermissions,
} from "@/lib/cross-platform-alarm";
import { getSocket } from "@/lib/socket-client";
import { showSystemNotification } from "@/lib/web-notification";

export interface AppNotification {
	id: string;
	title: string;
	message: string;
	type: "task" | "event" | "routine" | "system";
	timestamp: string;
	read: boolean;
}

interface NotificationContextType {
	notifications: AppNotification[];
	unreadCount: number;
	permission: NotificationPermission;
	soundEnabled: boolean;
	requestPermission: () => Promise<NotificationPermission>;
	toggleSound: () => void;
	markAsRead: (id: string) => void;
	markAllAsRead: () => void;
	clearNotifications: () => void;
	triggerNotification: (params: {
		id?: string;
		title: string;
		message: string;
		type?: "task" | "event" | "routine" | "system";
		ringCount?: number;
		ringIntervalSeconds?: number;
	}) => void;
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = "daypulse_notifications_history";
const SOUND_KEY = "daypulse_sound_enabled";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
	const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
	const [soundEnabled, setSoundEnabled] = React.useState(true);
	const [permission, setPermission] = React.useState<NotificationPermission>("default");
	const notifiedIdsRef = React.useRef<Set<string>>(new Set());

	React.useEffect(() => {
		requestPlatformNotificationPermissions().then((perm) => {
			setPermission(perm);
		});

		try {
			const savedSound = localStorage.getItem(SOUND_KEY);
			if (savedSound !== null) {
				setSoundEnabled(savedSound === "true");
			}
			const savedNotifications = localStorage.getItem(STORAGE_KEY);
			if (savedNotifications) {
				setNotifications(JSON.parse(savedNotifications));
			}
		} catch {
			// Ignore local storage error
		}
	}, []);

	const saveNotifications = React.useCallback((items: AppNotification[]) => {
		setNotifications(items);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 40)));
		} catch {
			// Storage quota or error
		}
	}, []);

	const triggerNotification = React.useCallback(
		({
			id,
			title,
			message,
			type = "system",
			ringCount,
			ringIntervalSeconds,
		}: {
			id?: string;
			title: string;
			message: string;
			type?: "task" | "event" | "routine" | "system";
			ringCount?: number;
			ringIntervalSeconds?: number;
		}) => {
			const alertId = id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

			if (notifiedIdsRef.current.has(alertId)) {
				return;
			}
			notifiedIdsRef.current.add(alertId);

			if (soundEnabled) {
				dispatchUnifiedAlarm({
					id: alertId,
					title,
					message,
					type,
					ringCount,
					ringIntervalSeconds,
				});
			} else {
				showSystemNotification(title, {
					body: message,
					tag: alertId,
				});
			}

			const isAlarmType = ringCount !== undefined && ringCount !== 1;
			toast(title, {
				description: message,
				action: isAlarmType
					? {
							label: "Stop Alarm",
							onClick: () => stopCurrentAlarm(),
						}
					: undefined,
			});

			const newNotification: AppNotification = {
				id: alertId,
				title,
				message,
				type,
				timestamp: new Date().toISOString(),
				read: false,
			};

			setNotifications((prev) => {
				const updated = [newNotification, ...prev].slice(0, 40);
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
				} catch {
					// ignore
				}
				return updated;
			});
		},
		[soundEnabled],
	);

	// Real-time WebSocket connection to standalone server
	React.useEffect(() => {
		const socket = getSocket();
		if (!socket) return;

		const handleServerAlarm = (data: {
			id: string;
			title: string;
			message: string;
			type: "task" | "event" | "routine";
			leadMinutes?: number;
		}) => {
			triggerNotification({
				id: `server_${data.id}_${Date.now()}`,
				title: data.title,
				message: data.message,
				type: data.type,
			});
		};

		const handleSyncUpdate = (data: { entityType: string; action: string; data: unknown }) => {
			window.dispatchEvent(new CustomEvent("daypulse:refresh", { detail: data }));
		};

		socket.on("notification:alarm", handleServerAlarm);
		socket.on("sync:update", handleSyncUpdate);

		return () => {
			socket.off("notification:alarm", handleServerAlarm);
			socket.off("sync:update", handleSyncUpdate);
		};
	}, [triggerNotification]);

	const requestPermission = React.useCallback(async () => {
		const perm = await requestPlatformNotificationPermissions();
		setPermission(perm);
		if (perm === "granted") {
			toast.success("Notifications enabled");
			triggerNotification({
				title: "Notifications Activated",
				message: "DayPulse will alert you ahead of your routines, tasks, and events.",
				type: "system",
			});
		} else {
			toast.error("Notification permissions not granted");
		}
		return perm;
	}, [triggerNotification]);

	const toggleSound = React.useCallback(() => {
		setSoundEnabled((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(SOUND_KEY, String(next));
			} catch {
				// ignore
			}
			if (next) {
				playNotificationChime();
				toast.success("Sound alerts enabled");
			} else {
				toast.info("Sound alerts muted");
			}
			return next;
		});
	}, []);

	const markAsRead = React.useCallback(
		(id: string) => {
			const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
			saveNotifications(updated);
		},
		[notifications, saveNotifications],
	);

	const markAllAsRead = React.useCallback(() => {
		const updated = notifications.map((n) => ({ ...n, read: true }));
		saveNotifications(updated);
	}, [notifications, saveNotifications]);

	const clearNotifications = React.useCallback(() => {
		saveNotifications([]);
	}, [saveNotifications]);

	// Resilient fallback scheduler: Polls active tasks and routines every 30s
	React.useEffect(() => {
		let isCancelled = false;

		const checkSchedules = async () => {
			if (isCancelled) return;
			if (!getAuthToken()) return;

			try {
				const [tasksRes, routinesRes] = await Promise.all([
					api
						.get<
							Array<{
								id: string;
								title: string;
								dueDate?: string;
								status: string;
								priority: string;
								type: string;
								remindBeforeMinutes: number;
								description?: string | null;
							}>
						>("/tasks?upcoming=true")
						.catch(() => null),
					api
						.get<
							Array<{
								id: string;
								title: string;
								isCompletedToday: boolean;
								timeSlot: string;
								targetTime?: string;
								daysOfWeek: string;
								reminderMinutes: number;
							}>
						>("/routines")
						.catch(() => null),
				]);

				if (tasksRes?.success && Array.isArray(tasksRes.data)) {
					const now = Date.now();
					for (const task of tasksRes.data) {
						if (task.status === "COMPLETED" || task.status === "CANCELLED" || !task.dueDate) {
							continue;
						}

						const dueTime = new Date(task.dueDate).getTime();
						const leadMs = (task.remindBeforeMinutes || 0) * 60 * 1000;
						const triggerTime = dueTime - leadMs;

						if (now >= triggerTime && now <= dueTime + 180000) {
							const uniqueKey = `task_${task.id}_${triggerTime}`;
							if (!notifiedIdsRef.current.has(uniqueKey)) {
								notifiedIdsRef.current.add(uniqueKey);
								const isEvent = task.type === "EVENT";
								const leadDesc =
									task.remindBeforeMinutes > 0 ? `in ${task.remindBeforeMinutes} minutes` : "now";
								const { config } = parseAlarmConfig(task.description);

								triggerNotification({
									id: uniqueKey,
									title: `${isEvent ? "Event Reminder" : "Upcoming Task"}: ${task.title}`,
									message: `${task.title} is scheduled ${leadDesc}.`,
									type: isEvent ? "event" : "task",
									ringCount: config.ringCount,
									ringIntervalSeconds: config.ringIntervalSeconds,
								});

								api
									.patch(`/tasks/${task.id}`, {
										lastTriggeredDate: new Date().toISOString(),
									})
									.then(() => {
										window.dispatchEvent(new CustomEvent("daypulse:refresh"));
									})
									.catch(() => {});
							}
						}
					}
				}

				if (routinesRes?.success && Array.isArray(routinesRes.data)) {
					const now = new Date();
					const currentDay = now.getDay().toString();
					const currentHours = now.getHours();
					const currentMinutes = now.getMinutes();
					const currentTotalMinutes = currentHours * 60 + currentMinutes;

					for (const routine of routinesRes.data) {
						if (routine.isCompletedToday || !routine.targetTime) {
							continue;
						}

						const activeDays = (routine.daysOfWeek || "").split(",");
						if (!activeDays.includes(currentDay)) {
							continue;
						}

						const [tHour, tMin] = routine.targetTime.split(":").map(Number);
						if (Number.isNaN(tHour) || Number.isNaN(tMin)) continue;

						const routineTargetMinutes = tHour * 60 + tMin;
						const reminderLead = routine.reminderMinutes || 0;
						const reminderTimeMinutes = routineTargetMinutes - reminderLead;

						if (currentTotalMinutes === reminderTimeMinutes) {
							const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
							const uniqueKey = `routine_${routine.id}_${todayStr}_${reminderTimeMinutes}`;

							if (!notifiedIdsRef.current.has(uniqueKey)) {
								notifiedIdsRef.current.add(uniqueKey);
								triggerNotification({
									id: uniqueKey,
									title: `Daily Routine: ${routine.title}`,
									message: `Time for your ${routine.timeSlot} routine: "${routine.title}". Target: ${routine.targetTime}`,
									type: "routine",
								});
							}
						}
					}
				}
			} catch {
				// Fallback check error
			}
		};

		const initialTimer = setTimeout(checkSchedules, 5000);
		const intervalTimer = setInterval(checkSchedules, 30000);

		return () => {
			isCancelled = true;
			clearTimeout(initialTimer);
			clearInterval(intervalTimer);
		};
	}, [triggerNotification]);

	const unreadCount = React.useMemo(() => {
		return notifications.filter((n) => !n.read).length;
	}, [notifications]);

	const value = React.useMemo(
		() => ({
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
		}),
		[
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
		],
	);

	return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextType {
	const context = React.useContext(NotificationContext);
	if (!context) {
		throw new Error("useNotifications must be used within a NotificationProvider");
	}
	return context;
}
