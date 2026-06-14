/**
 * Browser Push Notification Utilities for Revision Tracker
 */

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

export function sendBrowserNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void }
): Notification | null {
  if (!isBrowserNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  const { onClick, ...notifOptions } = options || {};

  const notification = new Notification(title, {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    ...notifOptions,
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }

  return notification;
}

export async function notifyDueRevisions(revisions: Array<{ topic: { name: string; subject: { name: string } }; revisionNumber: number }>) {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') return;

  if (revisions.length === 0) return;

  if (revisions.length === 1) {
    const rev = revisions[0];
    sendBrowserNotification(`📚 Revision Due: ${rev.topic.name}`, {
      body: `${rev.topic.subject.name} · Revision ${rev.revisionNumber} of 4`,
      tag: 'revision-due',
    });
  } else {
    const preview = revisions
      .slice(0, 3)
      .map((r) => `• ${r.topic.name} (Rev ${r.revisionNumber})`)
      .join('\n');

    sendBrowserNotification(`📚 ${revisions.length} Revisions Due Today`, {
      body: preview + (revisions.length > 3 ? `\n+${revisions.length - 3} more…` : ''),
      tag: 'revisions-due',
    });
  }
}

/**
 * Schedule a daily 8 AM browser notification check.
 * Call this on app startup (e.g., in the dashboard layout).
 */
export function scheduleDailyNotificationCheck(
  fetchDueRevisions: () => Promise<any[]>
): () => void {
  if (typeof window === 'undefined') return () => {};

  const checkAndNotify = async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Notify at 8:00 AM ±5 minutes
    if (hours === 8 && minutes < 5) {
      try {
        const revisions = await fetchDueRevisions();
        if (revisions.length > 0) {
          await notifyDueRevisions(revisions);
        }
      } catch (e) {
        console.warn('Failed to fetch due revisions for notification:', e);
      }
    }
  };

  // Check every 5 minutes
  const interval = setInterval(checkAndNotify, 5 * 60 * 1000);

  // Also check immediately on load
  setTimeout(checkAndNotify, 2000);

  return () => clearInterval(interval);
}
