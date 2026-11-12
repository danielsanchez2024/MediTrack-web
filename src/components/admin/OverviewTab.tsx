import { AlertTriangle, CheckCircle2, PauseCircle } from 'lucide-react';
import { getOpsOverview, getOpsTraffic } from '../../lib/api';
import { Loading, PanelState } from './PanelState';
import { StatTile, TimeChart, formatMs, formatPercent, type Tone } from './charts';
import { SWITCH_INFO } from './labels';
import { usePolling } from './usePolling';

interface TabProps {
  live: boolean;
  tick: number;
  onUpdated: (at: number) => void;
  onNavigate: (tab: 'control') => void;
}

const tone = (value: number, goodUpTo: number, warningUpTo: number): Tone =>
  value <= goodUpTo ? 'good' : value <= warningUpTo ? 'warning' : 'critical';

export default function OverviewTab({ live, tick, onUpdated, onNavigate }: TabProps) {
  const overview = usePolling(getOpsOverview, 'overview', live, tick, onUpdated);
  const traffic = usePolling(() => getOpsTraffic('1h'), 'traffic-1h', live, tick);

  const o = overview.data;
  const t = traffic.data;
  const serverErrorRate = o && o.lastHour.requests > 0 ? (o.lastHour.errors5xx / o.lastHour.requests) * 100 : 0;
  const heapPercent = o ? (o.system.heapUsedMb / Math.max(o.system.heapMaxMb, 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PanelState error={overview.error ?? traffic.error} loading={overview.loading}>
        {!o || !t ? (
          !overview.error && <Loading />
        ) : (
          <>
            <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <StatTile
                label="Peticiones por minuto"
                value={(o.last5Minutes.requests / 5).toFixed(1).replace(/\.0$/, '')}
                hint={`${o.last5Minutes.requests} en los últimos 5 min`}
              />
              <StatTile
                label="Errores del servidor (5xx)"
                value={formatPercent(serverErrorRate)}
                hint={`${o.lastHour.errors5xx} de ${o.lastHour.requests} en la última hora`}
                tone={serverErrorRate === 0 ? 'good' : serverErrorRate < 2 ? 'warning' : 'critical'}
                toneLabel={serverErrorRate === 0 ? 'Sin errores' : serverErrorRate < 2 ? 'Hay errores' : 'Muchos errores'}
              />
              <StatTile
                label="Latencia p95"
                value={formatMs(o.lastHour.p95Ms)}
                hint={`Promedio ${formatMs(o.lastHour.avgMs)} · última hora`}
                tone={tone(o.lastHour.p95Ms, 500, 1500)}
                toneLabel={o.lastHour.p95Ms <= 500 ? 'Rápido' : o.lastHour.p95Ms <= 1500 ? 'Lento' : 'Muy lento'}
              />
              <StatTile
                label="Base de datos"
                value={o.system.dbUp ? 'Activa' : 'Caída'}
                hint={o.system.dbUp ? `${o.system.dbPingMs} ms${o.system.dbSizeMb !== null ? ` · ${o.system.dbSizeMb} MB` : ''}` : 'No responde'}
                tone={o.system.dbUp ? 'good' : 'critical'}
                toneLabel={o.system.dbUp ? 'Responde' : 'Sin conexión'}
              />
              <StatTile
                label="Memoria del servidor"
                value={formatPercent(heapPercent)}
                hint={`${o.system.heapUsedMb} de ${o.system.heapMaxMb} MB`}
                tone={heapPercent < 70 ? 'good' : heapPercent < 90 ? 'warning' : 'critical'}
                toneLabel={heapPercent < 70 ? 'Holgada' : heapPercent < 90 ? 'Alta' : 'Casi llena'}
              />
              <StatTile
                label="Lecturas con IA hoy"
                value={o.ai.scansToday}
                hint={o.ai.maxPerDay > 0 ? `Límite diario: ${o.ai.maxPerDay}` : 'Sin límite diario'}
                tone={o.ai.scanEnabled ? undefined : 'warning'}
                toneLabel="Pausada por un administrador"
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2" aria-label="Última hora">
              <TimeChart
                title="Peticiones"
                subtitle="Última hora, por minuto"
                kind="bars"
                times={t.points.map((p) => p.at)}
                series={[{ key: 'requests', label: 'Peticiones', color: 'var(--viz-1)', values: t.points.map((p) => p.requests) }]}
                spanHours={1}
                loading={traffic.loading}
              />
              <TimeChart
                title="Errores"
                subtitle="Última hora, por minuto"
                kind="bars"
                times={t.points.map((p) => p.at)}
                series={[
                  { key: 'e4', label: 'Cliente (4xx)', color: 'var(--viz-warning)', values: t.points.map((p) => p.errors4xx) },
                  { key: 'e5', label: 'Servidor (5xx)', color: 'var(--viz-critical)', values: t.points.map((p) => p.errors5xx) }
                ]}
                spanHours={1}
                loading={traffic.loading}
                emptyText="Sin errores en la última hora"
              />
            </section>

            <section aria-label="Interruptores" className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-text">Interruptores de emergencia</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('control')}
                  className="text-xs font-semibold text-primary underline underline-offset-2"
                >
                  Administrar
                </button>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {o.switches.map((state) => (
                  <li key={state.key} className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs">
                    {state.enabled ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--viz-good)' }} aria-hidden="true" />
                    ) : (
                      <PauseCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--viz-critical)' }} aria-hidden="true" />
                    )}
                    <span className="font-semibold text-text">{SWITCH_INFO[state.key]?.label ?? state.key}</span>
                    <span className="ml-auto font-bold text-text-secondary">{state.enabled ? 'Activo' : 'Pausado'}</span>
                  </li>
                ))}
              </ul>
              {o.switches.some((state) => !state.enabled) && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <AlertTriangle className="h-4 w-4" style={{ color: 'var(--viz-warning)' }} />
                  Hay funciones pausadas: los usuarios las ven como no disponibles.
                </p>
              )}
            </section>
          </>
        )}
      </PanelState>
    </div>
  );
}
