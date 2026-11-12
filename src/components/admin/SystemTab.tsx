import { AlertTriangle } from 'lucide-react';
import { getOpsOverview, getOpsTraffic, type OpsRange } from '../../lib/api';
import { Loading, PanelState } from './PanelState';
import { Meter, StatTile, TimeChart, formatDuration, formatPercent } from './charts';
import { rangeHours } from './labels';
import { usePolling } from './usePolling';

interface TabProps {
  range: OpsRange;
  live: boolean;
  tick: number;
  onUpdated: (at: number) => void;
}

export default function SystemTab({ range, live, tick, onUpdated }: TabProps) {
  const overview = usePolling(getOpsOverview, 'system-overview', live, tick, onUpdated);
  const traffic = usePolling(() => getOpsTraffic(range), `system-${range}`, live, tick);

  const o = overview.data;
  const s = o?.system;
  const hours = rangeHours(range);
  const times = traffic.data?.points.map((p) => p.at) ?? [];

  return (
    <PanelState error={overview.error ?? traffic.error} loading={overview.loading}>
      {!o || !s ? (
        !overview.error && <Loading />
      ) : (
        <div className="flex flex-col gap-6">
          {!o.limits.rateLimitEnabled && s.environment === 'production' && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              El límite de velocidad está apagado en producción. Solo debe estarlo en pruebas automáticas.
            </div>
          )}

          <section aria-label="Servidor" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Tiempo encendido" value={formatDuration(s.uptimeSeconds)} hint={`Java ${s.javaVersion}`} />
            <StatTile label="Entorno" value={s.environment === 'production' ? 'Producción' : 'Desarrollo'} />
            <StatTile
              label="Base de datos"
              value={s.dbUp ? 'Activa' : 'Caída'}
              hint={s.dbUp ? `${s.dbPingMs} ms de respuesta${s.dbSizeMb !== null ? ` · ${s.dbSizeMb} MB` : ''}` : 'No responde'}
              tone={s.dbUp ? 'good' : 'critical'}
              toneLabel={s.dbUp ? 'Responde' : 'Sin conexión'}
            />
            <StatTile
              label="CPU del proceso"
              value={s.cpuLoadPct === null ? '—' : formatPercent(s.cpuLoadPct)}
              hint={`${s.threads} hilos activos`}
            />
          </section>

          <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm" aria-label="Recursos">
            <h3 className="text-sm font-bold text-text">Recursos</h3>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <Meter label="Memoria del servidor" value={s.heapUsedMb} max={s.heapMaxMb} valueText={`${s.heapUsedMb} de ${s.heapMaxMb} MB`} />
              {s.dbPoolMax !== null && s.dbPoolActive !== null ? (
                <Meter
                  label="Conexiones a la base de datos"
                  value={s.dbPoolActive}
                  max={s.dbPoolMax}
                  valueText={`${s.dbPoolActive} en uso de ${s.dbPoolMax}`}
                  hint={`${s.dbPoolIdle ?? 0} libres`}
                />
              ) : (
                <p className="text-xs text-text-caption">El pool de conexiones no está disponible.</p>
              )}
            </div>
            <p className="mt-4 text-xs text-text-secondary">
              Límite de velocidad: {o.limits.rateLimitEnabled ? 'activo' : 'apagado'} · {o.limits.rateLimiterTrackedKeys} claves en seguimiento (se limpian solas).
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <TimeChart
              title="Memoria usada"
              subtitle="En megabytes, una muestra por minuto con tráfico"
              kind="lines"
              times={times}
              series={[{ key: 'heap', label: 'Memoria (MB)', color: 'var(--viz-1)', values: traffic.data?.points.map((p) => p.heapUsedMb) ?? [] }]}
              spanHours={hours}
              format={(v) => `${Math.round(v)} MB`}
              loading={traffic.loading}
              areaUnder
              emptyText="Sin muestras en este periodo"
            />
            <TimeChart
              title="CPU del proceso"
              subtitle="Porcentaje, una muestra por minuto con tráfico"
              kind="lines"
              times={times}
              series={[{ key: 'cpu', label: 'CPU (%)', color: 'var(--viz-2)', values: traffic.data?.points.map((p) => p.cpuPct) ?? [] }]}
              spanHours={hours}
              format={(v) => `${Math.round(v)}%`}
              loading={traffic.loading}
              areaUnder
              emptyText="Sin muestras en este periodo"
            />
          </div>
        </div>
      )}
    </PanelState>
  );
}
