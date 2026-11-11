import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
  type ReminderTiming
} from '../../lib/api';
import { messageForError } from '../../lib/treatmentDrafts';
import { isValidPhone } from '../../lib/phone';

const TIMING_OPTIONS: { value: ReminderTiming; label: string }[] = [
  { value: 'BEFORE', label: '10 min antes' },
  { value: 'AT_TIME', label: 'A la hora' },
  { value: 'BOTH', label: 'Ambos' }
];

const TIMING_TEXT: Record<ReminderTiming, string> = {
  BEFORE: '10 minutos antes',
  AT_TIME: 'a la hora de la toma',
  BOTH: '10 minutos antes y a la hora'
};

interface ChannelToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}

function ChannelToggle({ id, checked, onChange, label, description }: ChannelToggleProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
      />
      <span>
        <span className="block text-sm font-semibold text-text">{label}</span>
        <span className="block text-xs text-text-caption">{description}</span>
      </span>
    </label>
  );
}

function TimingPicker({ name, value, onChange }: { name: string; value: ReminderTiming; onChange: (value: ReminderTiming) => void }) {
  return (
    <div role="radiogroup" aria-label="Cuándo avisar" className="ml-8 grid grid-cols-3 gap-2">
      {TIMING_OPTIONS.map((option) => (
        <label
          key={option.value}
          className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
            value === option.value
              ? 'border-primary bg-surface-info text-primary'
              : 'border-border text-text-secondary hover:bg-surface-muted'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

interface NotificationPreferencesSectionProps {
  // The account's login email, if known — reminders by email go there.
  email: string | null;
  // Only a caregiver gets the "people in my care" option.
  hasDependents: boolean;
}

export default function NotificationPreferencesSection({ email, hasDependents }: NotificationPreferencesSectionProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getNotificationPreferences()
      .then(setPreferences)
      .catch(() => setLoadError(true));
  }, []);

  function update<K extends keyof NotificationPreferences>(field: K, value: NotificationPreferences[K]) {
    setSaved(false);
    setPreferences((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences) return;
    setError(null);
    setSaved(false);

    const phone = preferences.phoneNumber?.trim() ?? '';
    if (preferences.smsEnabled && !phone) {
      setError('Escribe tu número de teléfono para recibir avisos por SMS.');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError('El número de teléfono no es válido.');
      return;
    }

    setSaving(true);
    try {
      setPreferences(await updateNotificationPreferences({ ...preferences, phoneNumber: phone || null }));
      setSaved(true);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 rounded-xl border border-border p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-text">
        <Bell className="h-4 w-4 text-primary" strokeWidth={1.75} />
        Avisos de tomas
      </p>

      {loadError && (
        <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
          No pudimos cargar tus preferencias de avisos.
        </div>
      )}
      {!preferences && !loadError && <p className="text-xs text-text-caption">Cargando…</p>}

      {preferences && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-caption">
              <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
              Correo
            </div>
            <ChannelToggle
              id="notify-email"
              checked={preferences.emailEnabled}
              onChange={(checked) => update('emailEnabled', checked)}
              label="Recibir avisos por correo"
              description={email ? `Se envían a ${email}.` : 'Tu cuenta no tiene correo; agrégalo arriba para recibirlos.'}
            />
            {preferences.emailEnabled && (
              <TimingPicker name="emailTiming" value={preferences.emailTiming} onChange={(value) => update('emailTiming', value)} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-caption">
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
              SMS
            </div>
            <ChannelToggle
              id="notify-sms"
              checked={preferences.smsEnabled}
              onChange={(checked) => update('smsEnabled', checked)}
              label="Recibir avisos por SMS"
              description="Un mensaje de texto al teléfono que indiques."
            />
            {preferences.smsEnabled && (
              <>
                <div className="ml-8 flex flex-col gap-1.5">
                  <label htmlFor="notify-phone" className="text-xs font-semibold text-text">
                    Número de teléfono
                  </label>
                  <input
                    id="notify-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Ej. +57 300 123 4567"
                    value={preferences.phoneNumber ?? ''}
                    onChange={(event) => update('phoneNumber', event.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <TimingPicker name="smsTiming" value={preferences.smsTiming} onChange={(value) => update('smsTiming', value)} />
              </>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-surface-muted p-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" strokeWidth={1.75} />
            <p className="text-xs text-text-secondary">
              <span className="font-semibold">Notificaciones en el móvil:</span>{' '}
              {preferences.pushEnabled ? `activadas (${TIMING_TEXT[preferences.pushTiming]})` : 'desactivadas'}. Se
              configuran desde la app MediTrack, en Mi cuenta.
            </p>
          </div>

          {hasDependents && (
            <ChannelToggle
              id="notify-dependents"
              checked={preferences.includeDependents}
              onChange={(checked) => update('includeDependents', checked)}
              label="Recibir también los avisos de las personas a mi cargo"
              description="Por los mismos canales que elegiste arriba."
            />
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
              {error}
            </div>
          )}
          {saved && (
            <div role="status" className="rounded-lg bg-success-bg px-3 py-2 text-xs font-medium text-secondary">
              Preferencias de avisos guardadas.
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar avisos'}
          </button>
        </>
      )}
    </form>
  );
}
