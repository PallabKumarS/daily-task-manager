"use client";

import * as React from "react";
import { toast } from "sonner";
import { playNotificationChime } from "@/lib/audio-chime";
import {
  getNotificationPermission,
  requestNotificationPermission,
  showSystemNotification,
  isNotificationSupported,
} from "@/lib/web-notification";

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
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }

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
    }: {
      id?: string;
      title: string;
      message: string;
      type?: "task" | "event" | "routine" | "system";
    }) => {
      const alertId = id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      if (notifiedIdsRef.current.has(alertId)) {
        return;
      }
      notifiedIdsRef.current.add(alertId);

      if (soundEnabled) {
        playNotificationChime();
      }

      showSystemNotification(title, {
        body: message,
        tag: alertId,
      });

      toast(title, {
        description: message,
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
    [soundEnabled]
  );

  const requestPermission = React.useCallback(async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    if (perm === "granted") {
      toast.success("Desktop notifications enabled");
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
    [notifications, saveNotifications]
  );

  const markAllAsRead = React.useCallback(() => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  }, [notifications, saveNotifications]);

  const clearNotifications = React.useCallback(() => {
    saveNotifications([]);
  }, [saveNotifications]);

  // Periodic Reminder Engine: Polls active tasks and routines every 30s
  React.useEffect(() => {
    let isCancelled = false;

    const checkSchedules = async () => {
      if (isCancelled) return;
      try {
        const [tasksRes, routinesRes] = await Promise.all([
          fetch("/api/tasks?upcoming=true"),
          fetch("/api/routines"),
        ]);

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          if (tasksData.success && Array.isArray(tasksData.data)) {
            const now = Date.now();
            for (const task of tasksData.data) {
              if (task.status === "COMPLETED" || task.status === "CANCELLED" || !task.dueDate) {
                continue;
              }

              const dueTime = new Date(task.dueDate).getTime();
              const leadMs = (task.remindBeforeMinutes || 0) * 60 * 1000;
              const triggerTime = dueTime - leadMs;

              // Check if we are within the alert window: between triggerTime and dueTime + 3 min
              if (now >= triggerTime && now <= dueTime + 180000) {
                const uniqueKey = `task_${task.id}_${triggerTime}`;
                if (!notifiedIdsRef.current.has(uniqueKey)) {
                  notifiedIdsRef.current.add(uniqueKey);
                  const isEvent = task.type === "EVENT";
                  const leadDesc = task.remindBeforeMinutes > 0 ? `in ${task.remindBeforeMinutes} minutes` : "now";

                  triggerNotification({
                    id: uniqueKey,
                    title: `${isEvent ? "Event Reminder" : "Upcoming Task"}: ${task.title}`,
                    message: `${task.title} is scheduled ${leadDesc}. Priority: ${task.priority}`,
                    type: isEvent ? "event" : "task",
                  });
                }
              }
            }
          }
        }

        if (routinesRes.ok) {
          const routinesData = await routinesRes.json();
          if (routinesData.success && Array.isArray(routinesData.data)) {
            const now = new Date();
            const currentDay = now.getDay().toString(); // 0-6
            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTotalMinutes = currentHours * 60 + currentMinutes;

            for (const routine of routinesData.data) {
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

              // Trigger if current minute matches
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
        }
      } catch {
        // Network or background check error
      }
    };

    // Initial check after 5s, then every 30s
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
    ]
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
