import { useId, useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { scorePassword } from '../lib/passwordStrength';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  // Only meaningful for a password someone is choosing right now (register, claim-account,
  // reset-password) — showing it on a login field would be scoring a password that already
  // exists, which makes no sense.
  showStrength?: boolean;
}

const STRENGTH_COLOR: Record<number, string> = {
  0: 'bg-danger',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-secondary',
  4: 'bg-secondary'
};

const STRENGTH_LABEL_COLOR: Record<number, string> = {
  0: 'text-danger-strong',
  1: 'text-danger-strong',
  2: 'text-warning',
  3: 'text-secondary',
  4: 'text-secondary'
};

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder = '••••••••',
  showStrength = false
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const strength = scorePassword(value);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-text">
        {label}
      </label>
      <div className="relative flex items-center">
        <Lock className="pointer-events-none absolute left-3.5 h-5 w-5 text-text-muted" strokeWidth={1.75} />
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-12 w-full rounded-lg border border-border bg-white pr-12 pl-11 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
            visible ? '' : 'tracking-[0.2em]'
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-3.5 text-text-muted transition-colors hover:text-text-secondary"
        >
          {visible ? <EyeOff className="h-5 w-5" strokeWidth={1.75} /> : <Eye className="h-5 w-5" strokeWidth={1.75} />}
        </button>
      </div>

      {showStrength && value && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  segment < strength.score ? STRENGTH_COLOR[strength.score] : 'bg-border'
                }`}
              />
            ))}
          </div>
          <span className={`text-xs font-semibold ${STRENGTH_LABEL_COLOR[strength.score]}`}>
            {strength.label}
          </span>
        </div>
      )}
    </div>
  );
}
