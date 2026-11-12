// The bell's inbox: the last reminders this browser announced, kept per user in localStorage so
// they survive a reload and are not announced twice. It is local to this browser on purpose — the
// server sends reminders by email, and the phone schedules its own; this is the web's record.

export type InboxKind = 'upcoming' | 'due';

export interface InboxItem {
  id: string; // `${kind}:${doseId}` — also the de-duplication key
  kind: InboxKind;
  title: string;
  body: string;
  at: string; // ISO instant the reminder was shown
  read: boolean;
}

const MAX_ITEMS = 30;
const EVENT = 'meditrack:inbox';

const storageKey = (userId: string) => `meditrack.inbox.${userId}`;

export function loadInbox(userId: string): InboxItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as InboxItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(userId: string, items: InboxItem[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Storage full or blocked (private mode): the bell just starts empty next time.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { userId } }));
}

// Returns false when this reminder is already in the inbox (so the caller must not announce it again).
export function addInboxItem(userId: string, item: Omit<InboxItem, 'read' | 'at'>): boolean {
  const items = loadInbox(userId);
  if (items.some((existing) => existing.id === item.id)) return false;
  save(userId, [{ ...item, at: new Date().toISOString(), read: false }, ...items]);
  return true;
}

export function markAllRead(userId: string): void {
  const items = loadInbox(userId);
  if (items.every((item) => item.read)) return;
  save(userId, items.map((item) => ({ ...item, read: true })));
}

export function clearInbox(userId: string): void {
  save(userId, []);
}

// Calls back with the fresh list whenever it changes — in this tab (custom event) or in another
// tab of the same browser (storage event).
export function subscribeInbox(userId: string, callback: (items: InboxItem[]) => void): () => void {
  const refresh = () => callback(loadInbox(userId));
  const onCustom = (event: Event) => {
    if ((event as CustomEvent<{ userId: string }>).detail?.userId === userId) refresh();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(userId)) refresh();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
