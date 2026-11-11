import { useState, type FormEvent } from 'react';
import { Mail, User, ShieldCheck, ArrowLeft } from 'lucide-react';
import PasswordField from './PasswordField';
import StepIndicator from './StepIndicator';
import { register, ApiError } from '../lib/api';
import { toSpanishMessage, toSpanishMessages } from '../lib/errorMessages';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registration only ever creates an AUTONOMOUS profile — profileType isn't sent, so the
// backend defaults to it. Dependent (ASSISTED) profiles are created by a caregiver and
// claimed via /claim-account, never through this form.
//
// Split into two steps (identity, then credentials) so the password fields and consent
// checkbox don't compete for attention with name/email on first load.
export default function RegisterForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Ingresa tu nombre completo.');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setErrorMessage('Ingresa un correo electrónico válido.');
      return;
    }

    setStep(2);
  }

  function handleBack() {
    setErrorMessage(null);
    setStep(1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      await register({ name, email, password, confirmPassword, healthDataConsentAccepted: consentAccepted });
      window.location.href = `/login?registered=1&email=${encodeURIComponent(email)}`;
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-8 shadow-md">
        <div className="mb-2 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold text-primary">Crear cuenta</h1>
          <p className="mt-1 text-xs font-medium text-text-caption">Datos clínicos protegidos</p>
        </div>

        <StepIndicator step={step} total={2} />

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong"
          >
            {errorMessage}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleContinue} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-semibold text-text">
                Nombre completo
              </label>
              <div className="relative flex items-center">
                <User
                  className="pointer-events-none absolute left-3.5 h-5 w-5 text-text-muted"
                  strokeWidth={1.75}
                />
                <input
                  id="name"
                  type="text"
                  required
                  maxLength={150}
                  autoComplete="name"
                  placeholder="Tu nombre y apellido"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 w-full rounded-lg border border-border bg-white pr-4 pl-11 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

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
              className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Continuar
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <button
              type="button"
              onClick={handleBack}
              className="-ml-1 flex items-center gap-1 self-start text-sm font-semibold text-text-secondary hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              Volver
            </button>

            <PasswordField
              label="Contraseña"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              showStrength
            />

            <PasswordField
              label="Confirmar contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />

            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-muted p-4 text-sm text-text-secondary">
              <input
                type="checkbox"
                required
                checked={consentAccepted}
                onChange={(event) => setConsentAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                Acepto que MediTrack trate mis datos de salud para brindarme el servicio de
                seguimiento de medicación, según la{' '}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  política de tratamiento de datos
                </a>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
