// Foreground-only browser notifications — they fire while this tab is open, using the
// Notification API directly. There's no service worker or push subscription here, so nothing
// arrives if the tab or browser is closed; that would need Web Push (service worker, VAPID keys
// and a backend that sends it, over HTTPS). Email reminders (sent server-side by
// DoseReminderService) are the channel that still works when nobody has the dashboard open.
// The bell (NotificationBell) decides WHEN to call notify(); this file only talks to the browser.

export type NotificationSupport = 'unsupported' | NotificationPermission;

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.requestPermission();
}

export function notify(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, { body, icon: '/favicon.svg' });
  } catch {
    // Some browsers (mobile Safari, some in-app webviews) support the permission prompt but
    // throw on `new Notification(...)` itself — never let a notification failure break the
    // actual dose-tracking flow.
  }
}
