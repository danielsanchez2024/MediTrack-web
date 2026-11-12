import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing, Globe, Smartphone, Trash2, CheckCheck } from 'lucide-react';
import type { InboxItem } from '../../lib/notificationInbox';
import type { NotificationSupport } from '../../lib/notifications';
import type { NotificationPreferences, ReminderTiming } from '../../lib/api';
import { formatTime } from '../../lib/date';

interface NotificationBellProps {
  // null while loading, or when the preferences could not be fetched.
  preferences: NotificationPreferences | null;
  browserSupport: NotificationSupport;
  inbox: InboxItem[];
  busy: boolean;
  error: string | null;
  onToggle: (enabled: boolean) => void;
  onAllowBrowser: () => void;
  onMarkAllRead: () => void;
  onClear: () => void;
}

const TIMING_TEXT: Record<ReminderTiming, string> = {
  BEFORE: 'antes de la toma',
  AT_TIME: 'a la hora de la toma',
  BOTH: 'antes y a la hora de la toma'
};

// One switch for the account's "notificaciones en el móvil" preference — the phone app reads the
// same preference — plus this browser's own permission and the list of recent reminders.
export default function NotificationBell({
  preferences,
  browserSupport,
  inbox,
  busy,
  error,
  onToggle,
  onAllowBrowser,
  onMarkAllRead,
  onClear
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  // What was unread when the panel opened stays highlighted while it is open.
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const enabled = preferences?.pushEnabled ?? false;
  const unread = inbox.filter((item) => !item.read).length;
  const needsBrowserPermission = enabled && browserSupport === 'default';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleOpen() {
    if (!open) {
      setHighlighted(new Set(inbox.filter((item) => !item.read).map((item) => item.id)));
      onMarkAllRead();
    }
    setOpen((value) => !value);
  }

  const Icon = !enabled ? BellOff : browserSupport === 'granted' ? BellRing : Bell;
  const label = unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones';

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon className={`h-5 w-5 ${enabled ? 'text-primary' : 'text-text-muted'}`} strokeWidth={1.75} />
        {unread > 0 && (
          <span
            data-testid="bell-unread"
            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {needsBrowserPermission && unread === 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-warning-strong" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="fixed inset-x-4 top-28 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-bold text-text">Notificaciones</p>
              <p className="text-xs text-text-caption">{enabled ? 'Avisos activados' : 'Avisos desactivados'}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Avisos de tomas"
              disabled={!preferences || busy}
              onClick={() => onToggle(!enabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
                enabled ? 'bg-success' : 'bg-text-muted'
              }`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          </div>

          {error && (
            <div role="alert" className="mx-4 mt-3 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
              {error}
            </div>
          )}
          {!preferences && !error && (
            <p className="px-4 pt-3 text-xs text-text-caption">No pudimos cargar tus preferencias de avisos. Intenta recargar la página.</p>
          )}

          {preferences && (
            <ul className="flex flex-col gap-2.5 border-b border-border px-4 py-3 text-xs text-text-secondary">
              <li className="flex items-start gap-2">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
                <span>
                  <strong className="text-text">Navegador:</strong>{' '}
                  {browserSupport === 'unsupported' && 'este navegador no admite notificaciones.'}
                  {browserSupport === 'denied' && 'bloqueadas. Habilítalas en la configuración del sitio de tu navegador.'}
                  {browserSupport === 'granted' &&
                    (enabled
                      ? `activadas ${TIMING_TEXT[preferences.pushTiming]}, mientras esta pestaña esté abierta.`
                      : 'apagadas.')}
                  {browserSupport === 'default' &&
                    (enabled ? 'falta tu permiso para mostrarlas.' : 'apagadas.')}
                </span>
              </li>
              {needsBrowserPermission && (
                <li>
                  <button
                    type="button"
                    onClick={onAllowBrowser}
                    className="h-9 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
                  >
                    Permitir en este navegador
                  </button>
                </li>
              )}
              <li className="flex items-start gap-2">
                <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
                <span>
                  <strong className="text-text">Celular:</strong>{' '}
                  {enabled
                    ? `activado (${TIMING_TEXT[preferences.pushTiming]}). Se aplica al abrir la app MediTrack; si es la primera vez, te pedirá permiso.`
                    : 'desactivado.'}
                </span>
              </li>
              <li className="text-text-caption">Con la pestaña cerrada, los avisos llegan por correo.</li>
            </ul>
          )}

          <div className="px-2 py-2">
            {inbox.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-text-caption">
                Aún no hay avisos. Cuando se acerque o llegue la hora de una toma, aparecerá aquí.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col overflow-y-auto" aria-label="Avisos recientes">
                {inbox.map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-lg px-3 py-2.5 ${highlighted.has(item.id) ? 'bg-surface-info' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-text">{item.title}</p>
                      <time dateTime={item.at} className="shrink-0 text-[11px] text-text-caption">
                        {formatTime(item.at)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary">{item.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {inbox.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <span className="flex items-center gap-1 text-[11px] text-text-caption">
                <CheckCheck className="h-3.5 w-3.5" /> Todo leído
              </span>
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-danger-strong"
              >
                <Trash2 className="h-3.5 w-3.5" /> Borrar avisos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
