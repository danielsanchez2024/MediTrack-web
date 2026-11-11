import { useState } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { acceptCurrentPrivacyPolicy, ApiError, type ConsentStatus } from '../../lib/api';
import { toSpanishMessage } from '../../lib/errorMessages';

interface ConsentGateModalProps {
  status: ConsentStatus;
  onAccepted: () => void;
  onLogout: () => void;
}

// Blocks the whole app until the caller accepts the currently active health-data policy. Shows
// for a brand-new registration too (their consent is recorded against whatever was active at
// signup, so this only actually appears if an admin publishes a newer version afterward — see
// UserServiceImpl.getHealthDataConsentStatus) and, more commonly, whenever that happens to an
// already-registered user. There's deliberately no "decline and continue" — either they accept,
// or they log out — since accepting this specific consent is what makes storing their health
// data lawful in the first place.
export default function ConsentGateModal({ status, onAccepted, onLogout }: ConsentGateModalProps) {
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    setAccepting(true);
    try {
      await acceptCurrentPrivacyPolicy();
      onAccepted();
    } catch (err) {
      setError(err instanceof ApiError ? toSpanishMessage(err.message) : 'No pudimos registrar tu aceptación. Intenta de nuevo.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/50 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
          <h2 className="text-lg font-bold text-text">Antes de continuar</h2>
        </div>

        <p className="mt-3 text-sm text-text-secondary">
          Publicamos una nueva versión ({status.version}) de nuestra política de tratamiento de
          datos de salud. Para seguir usando MediTrack necesitamos que la leas y la aceptes.
        </p>

        {status.contentUrl && (
          <a
            href={status.contentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Leer la política completa
          </a>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </div>
        )}

        <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-muted p-4 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            He leído y acepto la política de tratamiento de datos de salud, versión {status.version}.
          </span>
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Salir
          </button>
          <button
            type="button"
            disabled={!checked || accepting}
            onClick={handleAccept}
            className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accepting ? 'Guardando…' : 'Aceptar y continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
