import { useEffect, useState, type FormEvent } from 'react';
import { Mail, Clock, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import PasswordField from './PasswordField';
import { login, ApiError } from '../lib/api';
import { saveSession } from '../lib/session';
import { toSpanishMessage } from '../lib/errorMessages';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  // Whoever redirected here (an expired-session check elsewhere in the app) can add
  // ?sessionExpired=1 to show this banner — deliberately generic wording: the session could
  // have ended because the refresh token expired, because of a "logout everywhere" from
  // another device, or a technical refresh error, and there's no way to tell those apart, so
  // the copy doesn't claim a specific cause.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionExpired(params.get('sessionExpired') === '1');
    setJustRegistered(params.get('registered') === '1');
    setPasswordReset(params.get('passwordReset') === '1');
    const prefillEmail = params.get('email');
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await login({ email, password });
      saveSession(response);
      window.location.href = '/dashboard';
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? toSpanishMessage(error.message)
          : 'No pudimos conectar con el servidor. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-8 shadow-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold text-primary">MediTrack</h1>
          <p className="mt-1 text-xs font-medium text-text-caption">Datos clínicos protegidos</p>
        </div>

        {sessionExpired && (
          <div className="mb-5 flex items-start gap-2 rounded-lg bg-surface-info px-4 py-3 text-sm text-text-secondary">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
            <p>Tu sesión terminó por seguridad. Ingresa tus credenciales de nuevo.</p>
          </div>
        )}

        {justRegistered && (
          <div className="mb-5 flex items-start gap-2 rounded-lg bg-success-bg px-4 py-3 text-sm text-text-secondary">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" strokeWidth={1.75} />
            <p>Tu cuenta fue creada. Ingresa con tu correo y contraseña.</p>
          </div>
        )}

        {passwordReset && (
          <div className="mb-5 flex items-start gap-2 rounded-lg bg-success-bg px-4 py-3 text-sm text-text-secondary">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" strokeWidth={1.75} />
            <p>Tu contraseña fue actualizada. Ingresa con tu nueva contraseña.</p>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-text">
              Correo electrónico
            </label>
            <div className="relative flex items-center">
              <Mail
                className="pointer-events-none absolute left-3.5 h-5 w-5 text-text-muted"
                strokeWidth={1.75}
              />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-lg border border-border bg-white pr-4 pl-11 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <PasswordField label="Contraseña" value={password} onChange={setPassword} />

          <div className="text-right">
            <a href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-border-strong bg-surface-info p-4">
          <p className="text-sm text-text-secondary">
            ¿Tu cuidador te dio un código de invitación? Si eres familiar y vas a reclamar tu
            propia cuenta, no necesitas una contraseña previa.
          </p>
          <a
            href="/claim-account"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline"
          >
            Reclamar mi cuenta con código <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </a>
        </div>

        <p className="mt-6 text-center text-sm text-text-secondary">
          ¿Aún no tienes cuenta?{' '}
          <a href="/register" className="font-semibold text-primary hover:underline">
            Regístrate
          </a>
        </p>
      </div>
    </div>
  );
}
