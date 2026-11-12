import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

// Small, dependency-free charts for the admin panel. They follow the project's data-viz rules:
// thin marks (bars <= 24px with a 4px rounded data end and a 2px gap between stacked segments,
// 2px lines), hairline recessive grid, one y axis per chart, a legend for two or more series, text in
// text tokens (never the series color), a hover/keyboard readout, and a table view as the
// accessible twin of every chart.

export interface ChartSeries {
  key: string;
  label: string;
  color: string; // a CSS value, normally a var(--viz-*) token
  values: (number | null)[];
}

// ---- formatting ---------------------------------------------------------------------------------

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K`;
  return Number.isInteger(value) ? String(value) : trim(value);
}

export function formatMs(value: number): string {
  return value >= 1000 ? `${trim(value / 1000)} s` : `${Math.round(value)} ms`;
}

export function formatPercent(value: number): string {
  return `${trim(value)}%`;
}

export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function axisLabel(iso: string, spanHours: number): string {
  const date = new Date(iso);
  return spanHours <= 24
    ? date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
    : date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function fullLabel(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

// "Nice" axis ticks: 0 and round steps (1, 2, 5 x 10^k) up to at least the maximum.
export function niceTicks(max: number, wanted = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / wanted;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let value = 0; value < max + step; value += step) {
    ticks.push(Number(value.toFixed(6)));
    if (value >= max) break;
  }
  return ticks;
}

function useElementWidth(ref: React.RefObject<HTMLElement | null>, fallback = 640): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width) || fallback));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, fallback]);
  return width;
}

// ---- time chart (bars or lines) ------------------------------------------------------------------

interface TimeChartProps {
  title: string;
  subtitle?: string;
  kind: 'bars' | 'lines';
  times: string[];
  series: ChartSeries[];
  spanHours: number;
  format?: (value: number) => string;
  height?: number;
  loading?: boolean;
  emptyText?: string;
  // Lines only: a ~10% wash under the first series.
  areaUnder?: boolean;
}

const MARGIN = { top: 12, right: 12, bottom: 26, left: 46 };
const BAR_MAX_WIDTH = 24;
const SEGMENT_GAP = 2;

function roundedTopPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, height, width / 2));
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export function TimeChart({
  title,
  subtitle,
  kind,
  times,
  series,
  spanHours,
  format = formatCompact,
  height = 220,
  loading = false,
  emptyText = 'Sin datos en este periodo',
  areaUnder = false
}: TimeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(containerRef);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 60);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const count = times.length;
  const band = plotWidth / Math.max(count, 1);
  const stacked = kind === 'bars';

  const maxValue = useMemo(() => {
    let max = 0;
    for (let i = 0; i < count; i++) {
      if (stacked) {
        max = Math.max(max, series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
      } else {
        for (const s of series) max = Math.max(max, s.values[i] ?? 0);
      }
    }
    return max;
  }, [series, count, stacked]);

  const hasData = maxValue > 0;
  const ticks = niceTicks(maxValue || 1, 4);
  const yMax = ticks[ticks.length - 1];
  const y = (value: number) => MARGIN.top + plotHeight - (value / yMax) * plotHeight;
  const xCenter = (i: number) => MARGIN.left + band * (i + 0.5);

  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotWidth / 90))));

  function indexFromPointer(event: PointerEvent<SVGRectElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    return Math.min(count - 1, Math.max(0, Math.floor(x / band)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (count === 0) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setActive((current) => (current === null ? count - 1 : Math.min(count - 1, current + 1)));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setActive((current) => (current === null ? count - 1 : Math.max(0, current - 1)));
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  }

  const summary = hasData
    ? kind === 'bars'
      ? `Total en el periodo: ${format(series.reduce((sum, s) => sum + s.values.reduce<number>((a, v) => a + (v ?? 0), 0), 0))}`
      : series
          .map((s) => {
            const last = [...s.values].reverse().find((v) => v !== null);
            return last === undefined ? null : `${s.label}: último valor ${format(last as number)}`;
          })
          .filter(Boolean)
          .join('. ')
    : emptyText;

  const tooltipLeft = active === null ? 0 : xCenter(active) > width / 2 ? xCenter(active) - 12 : xCenter(active) + 12;
  const tooltipFlipped = active !== null && xCenter(active) > width / 2;

  return (
    <figure className="viz-root min-w-0 rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-caption">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {series.length >= 2 && (
            <ul className="flex flex-wrap items-center gap-3 text-xs text-text-secondary" aria-label="Leyenda">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={kind === 'bars' ? 'h-2.5 w-2.5 rounded-sm' : 'h-0.5 w-4 rounded-full'}
                    style={{ background: s.color }}
                  />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            aria-pressed={showTable}
            className="text-xs font-semibold text-text-secondary underline underline-offset-2 hover:text-primary"
          >
            {showTable ? 'Ver gráfica' : 'Ver como tabla'}
          </button>
        </div>
      </figcaption>

      {showTable ? (
        <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface-muted text-text-caption">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Hora</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-3 py-2 text-right font-semibold">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {times.map((time, i) => (
                <tr key={time} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 font-medium text-text-secondary">{fullLabel(time)}</th>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-text">
                      {s.values[i] === null || s.values[i] === undefined ? '—' : format(s.values[i] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`relative mt-3 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-primary/40 ${loading ? 'opacity-60' : ''}`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? (count > 0 ? count - 1 : null))}
          onBlur={() => setActive(null)}
          aria-label={`${title}. ${summary}. Usa las flechas para recorrer los valores.`}
        >
          <svg width={width} height={height} role="img" aria-hidden="true" className="block select-none">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke="var(--viz-grid)" strokeWidth={1} />
                <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="#64748b">
                  {format(tick)}
                </text>
              </g>
            ))}

            {times.map((time, i) =>
              i % labelEvery === 0 ? (
                <text key={time} x={xCenter(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#64748b">
                  {axisLabel(time, spanHours)}
                </text>
              ) : null
            )}

            {active !== null && kind === 'bars' && (
              <rect x={MARGIN.left + band * active} y={MARGIN.top} width={band} height={plotHeight} fill="rgb(15 23 42 / 0.05)" />
            )}
            {active !== null && kind === 'lines' && (
              <line x1={xCenter(active)} x2={xCenter(active)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--viz-axis)" strokeWidth={1} />
            )}

            {kind === 'bars' &&
              times.map((time, i) => {
                const barWidth = Math.min(BAR_MAX_WIDTH, Math.max(2, band * 0.7));
                const x = xCenter(i) - barWidth / 2;
                let accumulated = 0;
                const segments = series
                  .map((s) => ({ s, value: s.values[i] ?? 0 }))
                  .filter((segment) => segment.value > 0);
                return (
                  <g key={time}>
                    {segments.map(({ s, value }, index) => {
                      const top = y(accumulated + value);
                      const bottom = y(accumulated);
                      accumulated += value;
                      const isTop = index === segments.length - 1;
                      // A tiny count must still be visible; the exact number is in the tooltip.
                      const rawHeight = Math.max(bottom - top, 3);
                      const gap = isTop ? 0 : SEGMENT_GAP;
                      const segmentHeight = Math.max(rawHeight - gap, 1);
                      const segmentTop = bottom - rawHeight;
                      return isTop ? (
                        <path key={s.key} d={roundedTopPath(x, segmentTop, barWidth, segmentHeight, 4)} fill={s.color} />
                      ) : (
                        <rect key={s.key} x={x} y={segmentTop + gap} width={barWidth} height={segmentHeight} fill={s.color} />
                      );
                    })}
                  </g>
                );
              })}

            {kind === 'lines' &&
              series.map((s, seriesIndex) => {
                const segments: string[] = [];
                let current: string[] = [];
                s.values.forEach((value, i) => {
                  if (value === null || value === undefined) {
                    if (current.length) segments.push(current.join(' '));
                    current = [];
                  } else {
                    current.push(`${current.length ? 'L' : 'M'}${xCenter(i)},${y(value)}`);
                  }
                });
                if (current.length) segments.push(current.join(' '));

                const lastIndex = s.values.reduce<number>((found, v, i) => (v === null || v === undefined ? found : i), -1);
                return (
                  <g key={s.key}>
                    {areaUnder && seriesIndex === 0 && segments.map((d, i) => {
                      const points = d.split(' ');
                      const first = points[0].slice(1).split(',')[0];
                      const last = points[points.length - 1].slice(1).split(',')[0];
                      return (
                        <path key={i} d={`${d} L${last},${MARGIN.top + plotHeight} L${first},${MARGIN.top + plotHeight} Z`} fill={s.color} opacity={0.1} />
                      );
                    })}
                    {segments.map((d, i) => (
                      <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {lastIndex >= 0 && active === null && (
                      <circle cx={xCenter(lastIndex)} cy={y(s.values[lastIndex] as number)} r={4} fill={s.color} stroke="var(--viz-surface)" strokeWidth={2} />
                    )}
                    {active !== null && s.values[active] !== null && s.values[active] !== undefined && (
                      <circle cx={xCenter(active)} cy={y(s.values[active] as number)} r={4} fill={s.color} stroke="var(--viz-surface)" strokeWidth={2} />
                    )}
                  </g>
                );
              })}

            {!hasData && (
              <text x={MARGIN.left + plotWidth / 2} y={MARGIN.top + plotHeight / 2} textAnchor="middle" fontSize={12} fill="#64748b">
                {emptyText}
              </text>
            )}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              onPointerMove={(event) => count > 0 && setActive(indexFromPointer(event))}
              onPointerLeave={() => setActive(null)}
            />
          </svg>

          {active !== null && count > 0 && (
            <div
              className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-lg"
              style={{
                top: MARGIN.top,
                left: tooltipFlipped ? undefined : tooltipLeft,
                right: tooltipFlipped ? width - tooltipLeft : undefined
              }}
            >
              <p className="mb-1.5 font-semibold text-text-secondary">{fullLabel(times[active])}</p>
              <ul className="flex flex-col gap-1">
                {series.map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color, height: 3 }} />
                    <span className="font-bold tabular-nums text-text">
                      {s.values[active] === null || s.values[active] === undefined ? '—' : format(s.values[active] as number)}
                    </span>
                    <span className="text-text-caption">{s.label}</span>
                  </li>
                ))}
                {stacked && series.length > 1 && (
                  <li className="mt-0.5 flex items-center gap-2 border-t border-border pt-1">
                    <span className="font-bold tabular-nums text-text">
                      {format(series.reduce((sum, s) => sum + (s.values[active] ?? 0), 0))}
                    </span>
                    <span className="text-text-caption">Total</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

// ---- meter ---------------------------------------------------------------------------------------

interface MeterProps {
  label: string;
  value: number;
  // 0 means "no limit configured": the value is shown without a bar.
  max: number;
  valueText?: string;
  hint?: string;
}

export function Meter({ label, value, max, valueText, hint }: MeterProps) {
  const unlimited = max <= 0;
  const percent = unlimited ? 0 : Math.min(100, (value / max) * 100);
  const critical = !unlimited && percent >= 90;
  const warning = !unlimited && !critical && percent >= 70;
  const fill = critical ? 'var(--viz-critical)' : warning ? 'var(--viz-warning)' : 'var(--viz-1)';
  const text = valueText ?? (unlimited ? String(value) : `${formatCompact(value)} de ${formatCompact(max)}`);

  return (
    <div className="viz-root">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-sm font-bold tabular-nums text-text">{text}</p>
      </div>
      {unlimited ? (
        <p className="mt-1 text-xs text-text-caption">Sin límite configurado</p>
      ) : (
        <>
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={Math.min(value, max)}
            className="mt-2 h-2 overflow-hidden rounded-full"
            // the unfilled track is a lighter step of the same hue as the fill, so the state reads across the bar
            style={{ background: `color-mix(in srgb, ${fill} 22%, white)` }}
          >
            <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: fill }} />
          </div>
          {(critical || warning) && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-text-secondary">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: critical ? 'var(--viz-critical)' : 'var(--viz-warning)' }} />
              {critical ? 'Cerca del límite' : 'Uso alto'}
            </p>
          )}
        </>
      )}
      {hint && <p className="mt-1 text-xs text-text-caption">{hint}</p>}
    </div>
  );
}

// ---- stat tile -----------------------------------------------------------------------------------

export type Tone = 'good' | 'warning' | 'critical';

const TONE_STYLE: Record<Tone, { color: string; label: string; Icon: typeof CheckCircle2 }> = {
  good: { color: 'var(--viz-good)', label: 'Bien', Icon: CheckCircle2 },
  warning: { color: 'var(--viz-warning)', label: 'Atención', Icon: AlertTriangle },
  critical: { color: 'var(--viz-critical)', label: 'Crítico', Icon: XCircle }
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  toneLabel?: string;
}

// A status color never travels alone: it comes with an icon and a word.
export function StatTile({ label, value, hint, tone, toneLabel }: StatTileProps) {
  const style = tone ? TONE_STYLE[tone] : null;
  return (
    <div className="viz-root rounded-2xl border border-border bg-surface-card p-4 shadow-sm">
      <p className="text-xs font-semibold text-text-caption">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-tight text-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-caption">{hint}</p>}
      {style && (
        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-text-secondary">
          <style.Icon className="h-3.5 w-3.5" style={{ color: style.color }} />
          {toneLabel ?? style.label}
        </p>
      )}
    </div>
  );
}
