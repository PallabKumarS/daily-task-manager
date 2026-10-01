export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return "denied";
  }
}

export function showSystemNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return null;
  }

  try {
    return new Notification(title, {
      badge: "/icon.svg",
      icon: "/icon.svg",
      ...options,
    });
  } catch {
    return null;
  }
}
