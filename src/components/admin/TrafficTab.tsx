import { getOpsEndpoints, getOpsTraffic, type OpsRange } from '../../lib/api';
import { Loading, PanelState } from './PanelState';
import { StatTile, TimeChart, formatCompact, formatMs, formatPercent } from './charts';
import { rangeHours } from './labels';
import { usePolling } from './usePolling';

interface TabProps {
  range: OpsRange;
  live: boolean;
  tick: number;
  onUpdated: (at: number) => void;
}

function EndpointRow({ endpoint, total }: { endpoint: import('../../lib/api').OpsEndpointStat; total: number }) {
  const [method, ...rest] = endpoint.endpoint.split(' ');
  const errorRate = endpoint.count > 0 ? ((endpoint.errors4xx + endpoint.errors5xx) / endpoint.count) * 100 : 0;
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <span className="mr-2 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">{method}</span>
        <span className="break-all font-mono text-xs text-text">{rest.join(' ')}</span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-text">{formatCompact(endpoint.count)}</td>
      <td className="hidden px-3 py-2 text-right tabular-nums text-text-secondary sm:table-cell">
        {total > 0 ? formatPercent((endpoint.count / total) * 100) : '—'}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{formatPercent(errorRate)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{formatMs(endpoint.avgMs)}</td>
      <td className="hidden px-3 py-2 md:table-cell">
        <ul className="flex flex-wrap justify-end gap-1">
          {Object.entries(endpoint.statuses).map(([status, count]) => (
            <li key={status} className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-text-secondary">
              {status}: {formatCompact(count)}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

export default function TrafficTab({ range, live, tick, onUpdated }: TabProps) {
  const traffic = usePolling(() => getOpsTraffic(range), `traffic-${range}`, live, tick, onUpdated);
  const endpoints = usePolling(() => getOpsEndpoints(range), `endpoints-${range}`, live, tick);

  const t = traffic.data;
  const hours = rangeHours(range);
  const times = t?.points.map((p) => p.at) ?? [];
  const requestTotal = t?.totals.requests ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PanelState error={traffic.error ?? endpoints.error} loading={traffic.loading}>
        {!t ? (
          !traffic.error && <Loading />
        ) : (
          <>
            <section aria-label="Totales" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
              <StatTile label="Peticiones" value={formatCompact(t.totals.requests)} />
              <StatTile label="Errores del cliente (4xx)" value={formatCompact(t.totals.errors4xx)} hint="Incluye 401, 403 y 429" />
              <StatTile label="Errores del servidor (5xx)" value={formatCompact(t.totals.errors5xx)} />
              <StatTile label="Bloqueos por límite (429)" value={formatCompact(t.totals.rateLimited)} />
              <StatTile label="Sin sesión (401)" value={formatCompact(t.totals.unauthorized)} />
              <StatTile label="Latencia p50" value={formatMs(t.totals.p50Ms)} hint="Estimada por tramos" />
              <StatTile label="Latencia p95" value={formatMs(t.totals.p95Ms)} hint={`Máxima ${formatMs(t.totals.maxMs)}`} />
            </section>

            <TimeChart
              title="Peticiones"
              subtitle={`Cada barra agrupa ${t.bucketSeconds >= 3600 ? `${t.bucketSeconds / 3600} h` : `${t.bucketSeconds / 60} min`}`}
              kind="bars"
              times={times}
              series={[{ key: 'requests', label: 'Peticiones', color: 'var(--viz-1)', values: t.points.map((p) => p.requests) }]}
              spanHours={hours}
              loading={traffic.loading}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <TimeChart
                title="Errores"
                kind="bars"
                times={times}
                series={[
                  { key: 'e4', label: 'Cliente (4xx)', color: 'var(--viz-warning)', values: t.points.map((p) => p.errors4xx) },
                  { key: 'e5', label: 'Servidor (5xx)', color: 'var(--viz-critical)', values: t.points.map((p) => p.errors5xx) }
                ]}
                spanHours={hours}
                loading={traffic.loading}
                emptyText="Sin errores en este periodo"
              />
              <TimeChart
                title="Latencia"
                subtitle="p95 y promedio, en milisegundos"
                kind="lines"
                times={times}
                series={[
                  { key: 'p95', label: 'p95', color: 'var(--viz-1)', values: t.points.map((p) => (p.requests > 0 ? p.p95Ms : null)) },
                  { key: 'avg', label: 'Promedio', color: 'var(--viz-2)', values: t.points.map((p) => (p.requests > 0 ? p.avgMs : null)) }
                ]}
                spanHours={hours}
                format={formatMs}
                loading={traffic.loading}
              />
            </div>

            <section aria-label="Endpoints" className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
              <h3 className="text-sm font-bold text-text">Endpoints más usados</h3>
              <p className="mt-0.5 text-xs text-text-caption">
                Los identificadores se agrupan como <code>{'{id}'}</code>; nunca se guardan direcciones IP, correos ni datos de salud.
              </p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <caption className="sr-only">Endpoints más usados</caption>
                  <thead className="bg-surface-muted text-text-caption">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Endpoint</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Peticiones</th>
                      <th scope="col" className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Del total</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Errores</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Latencia</th>
                      <th scope="col" className="hidden px-3 py-2 text-right font-semibold md:table-cell">Códigos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(endpoints.data ?? []).map((endpoint) => (
                      <EndpointRow key={endpoint.endpoint} endpoint={endpoint} total={requestTotal} />
                    ))}
                    {endpoints.data?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-text-caption">Sin tráfico en este periodo</td>
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
