import { useState, type FormEvent } from 'react';
import { Mail, ShieldCheck, MailCheck } from 'lucide-react';
import { requestPasswordReset, ApiError } from '../lib/api';
import { toSpanishMessage } from '../lib/errorMessages';

// The backend always responds 204 here, whether or not the email belongs to an account —
// see UserServiceImpl.requestPasswordReset. This screen mirrors that: submitting always
// shows the same generic "check your inbox" message, never "no account with that email".
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setSubmitted(true);
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
          <h1 className="text-2xl font-bold text-primary">Recuperar contraseña</h1>
          <p className="mt-1 text-xs font-medium text-text-caption">Datos clínicos protegidos</p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg">
              <MailCheck className="h-6 w-6 text-secondary" strokeWidth={1.75} />
            </div>
            <p className="text-sm text-text-secondary">
              Si <strong className="text-text">{email}</strong> está registrado en MediTrack, te
              enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y
              la carpeta de spam.
            </p>
            <a href="/login" className="mt-2 text-sm font-semibold text-primary hover:underline">
              Volver a iniciar sesión
            </a>
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-text-secondary">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu
              contraseña.
            </p>

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

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              <a href="/login" className="font-semibold text-primary hover:underline">
                Volver a iniciar sesión
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
