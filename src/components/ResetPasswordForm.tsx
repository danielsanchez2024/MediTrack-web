import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import PasswordField from './PasswordField';
import { resetPassword, ApiError } from '../lib/api';
import { toSpanishMessage, toSpanishMessages } from '../lib/errorMessages';

export default function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    if (!token) {
      return;
    }

    setLoading(true);

    try {
      // The backend returns a full login session here (it also auto-invalidates every
      // existing session as part of the reset), but after just proving control of the
      // account via a one-time link, sending the person straight into the app skips the
      // usual "prove you know your new password" step. Send them to log in instead.
      await resetPassword({ resetToken: token, newPassword, confirmPassword });
      window.location.href = '/login?passwordReset=1';
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.details.length > 0 ? toSpanishMessages(error.details) : toSpanishMessage(error.message));
      } else {
        setErrorMessage('No pudimos conectar con el servidor. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  // The link is malformed or already used up (token stripped from the URL) — nothing to
  // submit here, only a way back to request a fresh one.
  if (token === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-8 text-center shadow-md">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg-soft">
            <AlertTriangle className="h-6 w-6 text-danger-strong" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-bold text-text">Enlace no válido</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Este enlace de restablecimiento no es válido o está incompleto.
          </p>
          <a
            href="/forgot-password"
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Solicitar un enlace nuevo
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-8 shadow-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold text-primary">Nueva contraseña</h1>
          <p className="mt-1 text-xs font-medium text-text-caption">Datos clínicos protegidos</p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong"
          >
            {errorMessage}
            {errorMessage.startsWith('Este enlace') && (
              <>
                {' '}
                <a href="/forgot-password" className="underline">
                  Solicitar uno nuevo
                </a>
                .
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <PasswordField
            label="Nueva contraseña"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            showStrength
          />

          <PasswordField
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />

          <p className="text-xs text-text-caption">
            Por tu seguridad, cerraremos todas tus sesiones activas después de este cambio.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
