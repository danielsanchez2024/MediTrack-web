import { useState, type FormEvent } from 'react';
import { CheckCircle2, PauseCircle, ShieldAlert } from 'lucide-react';
import { ApiError, getOpsAudit, getOpsSwitches, setOpsSwitch, type OpsSwitchState } from '../../lib/api';
import { toSpanishMessage, toSpanishMessages } from '../../lib/errorMessages';
import { Loading, PanelState } from './PanelState';
import { AUDIT_ACTIONS, SWITCH_INFO, formatWhen } from './labels';
import { usePolling } from './usePolling';

interface TabProps {
  live: boolean;
  tick: number;
  onUpdated: (at: number) => void;
}

function SwitchCard({ state, onChanged }: { state: OpsSwitchState; onChanged: () => void }) {
  const info = SWITCH_INFO[state.key] ?? { label: state.key, effect: '' };
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turningOff = state.enabled;

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setOpsSwitch(state.key, !state.enabled, reason);
      setOpen(false);
      setReason('');
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.details.length > 0 ? toSpanishMessages(caught.details) : toSpanishMessage(caught.message)
          : 'No pudimos guardar el cambio. Intenta de nuevo.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="viz-root rounded-2xl border border-border bg-surface-card p-5 shadow-sm" aria-label={info.label}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">{info.label}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
            {state.enabled ? (
              <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--viz-good)' }} aria-hidden="true" />
            ) : (
              <PauseCircle className="h-4 w-4" style={{ color: 'var(--viz-critical)' }} aria-hidden="true" />
            )}
            {state.enabled ? 'Activo' : 'Pausado'}
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors ${
              turningOff ? 'border border-danger/40 text-danger-strong hover:bg-danger-bg' : 'bg-primary text-white hover:bg-primary-hover'
            }`}
          >
            {turningOff ? 'Pausar' : 'Reactivar'}
          </button>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-text-caption">
        {turningOff ? (
          <>
            <span className="font-semibold text-text-secondary">Si lo pausas: </span>
            {info.effect}
          </>
        ) : (
          <>
            <span className="font-semibold text-text-secondary">Mientras esté pausado: </span>
            {info.effect}
          </>
        )}
      </p>

      {!state.enabled && state.reason && (
        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold">Motivo:</span> {state.reason}
          <span className="block text-text-caption">
            {state.updatedBy ?? 'Un administrador'} · {formatWhen(state.updatedAt)}
          </span>
        </p>
      )}

      {open && (
        <form onSubmit={confirm} className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-4">
          {turningOff ? (
            <>
              <p className="flex items-start gap-2 text-xs font-semibold text-text">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--viz-warning)' }} aria-hidden="true" />
                Esto afecta a todos los usuarios de inmediato.
              </p>
              <label htmlFor={`reason-${state.key}`} className="text-xs font-semibold text-text">
                Motivo (queda en la auditoría)
              </label>
              <textarea
                id={`reason-${state.key}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
                rows={2}
                required
                className="w-full resize-none rounded-lg border border-border bg-white p-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Ej. el proveedor de IA está caído"
              />
            </>
          ) : (
            <p className="text-xs font-semibold text-text">¿Reactivar «{info.label}» para todos?</p>
          )}
          {error && (
            <p role="alert" className="text-xs font-medium text-danger-strong">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || (turningOff && reason.trim().length === 0)}
              className="h-9 rounded-lg bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Guardando…' : turningOff ? 'Confirmar pausa' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="h-9 rounded-lg px-3 text-xs font-semibold text-text-secondary hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

export default function ControlTab({ live, tick, onUpdated }: TabProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const switches = usePolling(getOpsSwitches, `switches-${reloadKey}`, live, tick, onUpdated);
  const audit = usePolling(() => getOpsAudit(50), `audit-${reloadKey}`, live, tick);

  return (
    <div className="flex flex-col gap-6">
      <PanelState error={switches.error ?? audit.error} loading={switches.loading}>
        {!switches.data ? (
          !switches.error && <Loading />
        ) : (
          <>
            <section aria-label="Interruptores">
              <h2 className="text-lg font-bold text-text">Interruptores de emergencia</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Para actuar sin desplegar: pausar una función afecta a todos los usuarios de inmediato. Cada cambio queda en la auditoría.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {switches.data.map((state) => (
                  <SwitchCard key={state.key} state={state} onChanged={() => setReloadKey((value) => value + 1)} />
                ))}
              </div>
            </section>

            <section aria-label="Auditoría" className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h2 className="text-lg font-bold text-text">Auditoría</h2>
              <p className="mt-1 text-sm text-text-secondary">Quién hizo qué en este panel, lo más reciente primero.</p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[30rem] text-left text-xs">
                  <caption className="sr-only">Registro de auditoría</caption>
                  <thead className="bg-surface-muted text-text-caption">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Cuándo</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Quién</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Qué hizo</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(audit.data ?? []).map((entry) => (
                      <tr key={entry.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-text-secondary">{formatWhen(entry.at)}</td>
                        <td className="px-3 py-2 text-text">{entry.adminEmail}</td>
                        <td className="px-3 py-2 text-text">
                          {AUDIT_ACTIONS[entry.action] ?? entry.action}
                          {entry.target && <span className="ml-1 font-semibold">{SWITCH_INFO[entry.target]?.label ?? entry.target}</span>}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">{entry.details ?? '—'}</td>
                      </tr>
                    ))}
                    {audit.data?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-text-caption">Todavía no hay acciones registradas</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </PanelState>
    </div>
  );
}
