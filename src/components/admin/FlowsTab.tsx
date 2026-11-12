import { AlertTriangle, PauseCircle, XCircle } from 'lucide-react';
import { getOpsFlows, type OpsRange } from '../../lib/api';
import { Loading, PanelState } from './PanelState';
import { formatCompact } from './charts';
import { usePolling } from './usePolling';

type OutcomeTone = 'normal' | 'warning' | 'critical' | 'paused';

interface FlowDef {
  key: string;
  title: string;
  description: string;
  outcomes: Record<string, { label: string; tone: OutcomeTone }>;
}

export const FLOW_DEFS: FlowDef[] = [
  {
    key: 'login',
    title: 'Inicios de sesión',
    description: 'Intentos de entrar a una cuenta.',
    outcomes: {
      ok: { label: 'Correctos', tone: 'normal' },
      failed: { label: 'Fallidos (credenciales incorrectas)', tone: 'warning' },
      blocked: { label: 'Bloqueados por límite', tone: 'critical' }
    }
  },
  {
    key: 'register',
    title: 'Registro de cuentas',
    description: 'Creación de cuentas nuevas.',
    outcomes: {
      ok: { label: 'Cuentas creadas', tone: 'normal' },
      duplicate: { label: 'Correo ya registrado', tone: 'warning' },
      invalid: { label: 'Datos inválidos', tone: 'warning' },
      blocked: { label: 'Bloqueados por límite', tone: 'critical' },
      paused: { label: 'Rechazados: registro pausado', tone: 'paused' }
    }
  },
  {
    key: 'passwordReset',
    title: 'Recuperar contraseña',
    description: 'Solicitudes de enlace y contraseñas restablecidas.',
    outcomes: {
      requested: { label: 'Enlaces solicitados', tone: 'normal' },
      completed: { label: 'Contraseñas restablecidas', tone: 'normal' }
    }
  },
  {
    key: 'scan',
    title: 'Lectura de fórmulas con IA',
    description: 'Fotos enviadas al lector y qué pasó con cada una.',
    outcomes: {
      ok: { label: 'Leídas', tone: 'normal' },
      unreadable: { label: 'No se pudo leer', tone: 'warning' },
      noConsent: { label: 'Rechazadas: sin consentimiento', tone: 'warning' },
      limitReached: { label: 'Límite alcanzado u ocupado', tone: 'critical' },
      paused: { label: 'Rechazadas: lectura pausada', tone: 'paused' }
    }
  },
  {
    key: 'treatments',
    title: 'Tratamientos',
    description: 'Tratamientos creados.',
    outcomes: { created: { label: 'Creados', tone: 'normal' } }
  },
  {
    key: 'doses',
    title: 'Tomas',
    description: 'Tomas registradas (tomada u omitida).',
    outcomes: { recorded: { label: 'Registradas', tone: 'normal' } }
  },
  {
    key: 'emergencyCard',
    title: 'Ficha de emergencia',
    description: 'Descargas del PDF.',
    outcomes: { pdfDownloads: { label: 'PDF descargados', tone: 'normal' } }
  },
  {
    key: 'reminders',
    title: 'Recordatorios de dosis',
    description: 'Avisos preparados por el servidor.',
    outcomes: {
      upcoming: { label: 'Antes de la toma', tone: 'normal' },
      due: { label: 'A la hora de la toma', tone: 'normal' }
    }
  },
  {
    key: 'email',
    title: 'Correos',
    description: 'Correos que el servidor intentó enviar (recordatorios y recuperación).',
    outcomes: {
      sent: { label: 'Enviados', tone: 'normal' },
      failed: { label: 'Fallidos', tone: 'critical' }
    }
  },
  {
    key: 'sms',
    title: 'SMS',
    description: 'Mensajes de texto. Mientras no haya un proveedor contratado, solo se simulan en el registro.',
    outcomes: { sent: { label: 'Enviados', tone: 'normal' } }
  }
];

const TONE_COLOR: Record<OutcomeTone, string> = {
  normal: 'var(--viz-1)',
  warning: 'var(--viz-warning)',
  critical: 'var(--viz-critical)',
  paused: 'var(--viz-neutral)'
};

// Every non-normal outcome carries an icon and its words, never color alone.
function OutcomeIcon({ tone }: { tone: OutcomeTone }) {
  if (tone === 'critical') return <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: TONE_COLOR.critical }} aria-hidden="true" />;
  if (tone === 'warning') return <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: TONE_COLOR.warning }} aria-hidden="true" />;
  if (tone === 'paused') return <PauseCircle className="h-3.5 w-3.5 shrink-0" style={{ color: TONE_COLOR.paused }} aria-hidden="true" />;
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_COLOR.normal }} aria-hidden="true" />;
}

export function FlowCard({ def, counts }: { def: FlowDef; counts: Record<string, number> | undefined }) {
  const entries = Object.entries(def.outcomes);
  const total = entries.reduce((sum, [id]) => sum + (counts?.[id] ?? 0), 0);

  return (
    <article className="viz-root rounded-2xl border border-border bg-surface-card p-5 shadow-sm" aria-label={def.title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">{def.title}</h3>
          <p className="mt-0.5 text-xs text-text-caption">{def.description}</p>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none text-text" aria-label={`Total ${total}`}>
          {formatCompact(total)}
        </p>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {entries.map(([id, outcome]) => {
          const count = counts?.[id] ?? 0;
          const share = total > 0 ? (count / total) * 100 : 0;
          return (
            <li key={id}>
              <div className="flex items-center gap-2 text-xs">
                <OutcomeIcon tone={outcome.tone} />
                <span className="text-text-secondary">{outcome.label}</span>
                <span className="ml-auto font-bold tabular-nums text-text">{formatCompact(count)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${TONE_COLOR[outcome.tone]} 20%, white)` }}>
                <div className="h-full rounded-full" style={{ width: `${share}%`, background: TONE_COLOR[outcome.tone] }} />
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

interface TabProps {
  range: OpsRange;
  live: boolean;
  tick: number;
  onUpdated: (at: number) => void;
}

export default function FlowsTab({ range, live, tick, onUpdated }: TabProps) {
  const flows = usePolling(() => getOpsFlows(range), `flows-${range}`, live, tick, onUpdated);

  return (
    <PanelState error={flows.error} loading={flows.loading}>
      {!flows.data ? (
        !flows.error && <Loading />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FLOW_DEFS.map((def) => (
            <FlowCard key={def.key} def={def} counts={flows.data?.flows[def.key]} />
          ))}
        </div>
      )}
    </PanelState>
  );
}
