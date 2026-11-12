import { AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react';
import { getOpsFlows, getOpsOverview } from '../../lib/api';
import { FLOW_DEFS, FlowCard } from './FlowsTab';
import { Loading, PanelState } from './PanelState';
import { Meter } from './charts';
import { usePolling } from './usePolling';

interface TabProps {
  live: boolean;
  tick: number;
  onUpdated: (at: number) => void;
  onNavigate: (tab: 'control') => void;
}

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  'openai-compatible': 'Servicio externo compatible con OpenAI'
};

export default function AiTab({ live, tick, onUpdated, onNavigate }: TabProps) {
  const overview = usePolling(getOpsOverview, 'ai-overview', live, tick, onUpdated);
  const flows = usePolling(() => getOpsFlows('24h'), 'ai-flows', live, tick);
  const ai = overview.data?.ai;
  const scanDef = FLOW_DEFS.find((def) => def.key === 'scan');

  return (
    <PanelState error={overview.error ?? flows.error} loading={overview.loading}>
      {!ai || !scanDef ? (
        !overview.error && <Loading />
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm" aria-label="Proveedor">
            <h3 className="text-sm font-bold text-text">Quién lee las fórmulas</h3>
            <p className="mt-1 text-lg font-bold text-text">{PROVIDER_NAMES[ai.provider] ?? ai.provider}</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                {ai.dataPolicy === 'verified' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--viz-good)' }} aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--viz-warning)' }} aria-hidden="true" />
                )}
                <span>
                  {ai.dataPolicy === 'verified'
                    ? 'Condiciones de datos verificadas: sin entrenamiento con nuestros datos y retención mínima.'
                    : 'Condiciones de datos sin verificar: el proveedor podría conservar o reutilizar la foto, por eso cada lectura pide el consentimiento del usuario.'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                {ai.scanEnabled ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--viz-good)' }} aria-hidden="true" />
                ) : (
                  <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--viz-critical)' }} aria-hidden="true" />
                )}
                <span>
                  {ai.scanEnabled ? 'La lectura de fórmulas está activa.' : 'La lectura de fórmulas está pausada: ninguna foto sale hacia el proveedor.'}{' '}
                  <button type="button" onClick={() => onNavigate('control')} className="font-semibold text-primary underline underline-offset-2">
                    Cambiar
                  </button>
                </span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm" aria-label="Límites de uso">
            <h3 className="text-sm font-bold text-text">Límites de uso</h3>
            <p className="mt-0.5 text-xs text-text-caption">Contadores en memoria: se reinician a medianoche y al reiniciar el servidor.</p>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              <Meter label="Lecturas hoy (todos los usuarios)" value={ai.scansToday} max={ai.maxPerDay} />
              <Meter label="Lecturas en el último minuto" value={ai.scansLastMinute} max={ai.maxPerMinute} />
              <Meter label="Lecturas en curso ahora" value={ai.inFlight} max={ai.maxConcurrent} hint="Cada una ocupa memoria y al proveedor" />
            </div>
            <p className="mt-4 text-xs text-text-secondary">
              {ai.maxPerUserPerDay > 0
                ? `Cada usuario puede hacer hasta ${ai.maxPerUserPerDay} lecturas por día.`
                : 'No hay límite diario por usuario.'}
            </p>
          </section>

          <FlowCard def={scanDef} counts={flows.data?.flows.scan} />
          <p className="-mt-3 text-xs text-text-caption">Resultado de las lecturas en las últimas 24 horas.</p>
        </div>
      )}
    </PanelState>
  );
}
