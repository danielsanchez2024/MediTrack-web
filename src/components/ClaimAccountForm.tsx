import { useEffect, useState, type FormEvent } from 'react';
import { Mail, KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react';
import PasswordField from './PasswordField';
import StepIndicator from './StepIndicator';
import { claimAccount, ApiError } from '../lib/api';
import { saveSession } from '../lib/session';
import { toSpanishMessage, toSpanishMessages } from '../lib/errorMessages';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The invite code is a raw string a caregiver shares directly (in person, by chat, however
// they choose) — the backend never emails it. If a caregiver instead pastes it into a link,
// ?token= prefills the field, but typing the code in by hand is the primary path.
//
// Split into two steps (invite code + email, then credentials) to match the registration
// flow's shape.
export default function ClaimAccountForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [claimToken, setClaimToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillToken = params.get('token');
    if (prefillToken) {
      setClaimToken(prefillToken);
    }
  }, []);

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!claimToken.trim()) {
      setErrorMessage('Ingresa el código de invitación.');
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
      const response = await claimAccount({ claimToken, email, password, confirmPassword });
      saveSession(response);
      window.location.href = '/dashboard';
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
          <h1 className="text-2xl font-bold text-primary">Reclamar mi cuenta</h1>
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
            <p className="text-sm text-text-secondary">
              Ingresa el código de invitación que te dio tu cuidador y el correo con el que
              quieres acceder a tu cuenta.
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="claimToken" className="text-sm font-semibold text-text">
                Código de invitación
              </label>
              <div className="relative flex items-center">
                <KeyRound
                  className="pointer-events-none absolute left-3.5 h-5 w-5 text-text-muted"
                  strokeWidth={1.75}
                />
                <input
                  id="claimToken"
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Pega aquí el código"
                  value={claimToken}
                  onChange={(event) => setClaimToken(event.target.value)}
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

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Reclamando cuenta…' : 'Reclamar cuenta'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          ¿Ya reclamaste tu cuenta?{' '}
          <a href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
