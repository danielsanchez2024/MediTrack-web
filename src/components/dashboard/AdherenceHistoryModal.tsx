import { useEffect, useState } from 'react';
import { X, History, CalendarRange } from 'lucide-react';
import {
  getAdherenceSummaryInRange,
  getScheduledDosesInRange,
  ApiError,
  type AdherenceSummary,
  type ScheduledDose
} from '../../lib/api';
import { toSpanishMessage } from '../../lib/errorMessages';
import { toISODate, formatFullDate, formatTime } from '../../lib/date';

interface AdherenceHistoryModalProps {
  profileId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<ScheduledDose['status'], { label: string; className: string }> = {
  TAKEN: { label: 'Tomada', className: 'bg-success-bg text-secondary' },
  SKIPPED: { label: 'Omitida', className: 'bg-warning-bg text-warning' },
  MISSED: { label: 'No tomada', className: 'bg-danger-bg text-danger-strong' },
  PENDING: { label: 'Pendiente', className: 'bg-surface-muted text-text-secondary' }
};

type QuickRange = '7' | '30' | 'custom';

function rangeFor(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

export default function AdherenceHistoryModal({ profileId, onClose }: AdherenceHistoryModalProps) {
  const [quickRange, setQuickRange] = useState<QuickRange>('7');
  const [customStart, setCustomStart] = useState(() => rangeFor(7).startDate);
  const [customEnd, setCustomEnd] = useState(() => rangeFor(7).endDate);

  const [summary, setSummary] = useState<AdherenceSummary | null>(null);
  const [doses, setDoses] = useState<ScheduledDose[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = quickRange === 'custom' ? { startDate: customStart, endDate: customEnd } : rangeFor(Number(quickRange));

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setDoses(null);
    setError(null);

    Promise.all([
      getAdherenceSummaryInRange(profileId, startDate, endDate),
      getScheduledDosesInRange(profileId, startDate, endDate)
    ])
      .then(([summaryResult, doseList]) => {
        if (cancelled) return;
        setSummary(summaryResult);
        setDoses(doseList);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? toSpanishMessage(err.message) : 'No pudimos cargar el historial.');
      });

    return () => {
      cancelled = true;
    };
  }, [profileId, startDate, endDate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Historial de adherencia</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setQuickRange('7')}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold ${quickRange === '7' ? 'bg-primary text-white' : 'border border-border text-text-secondary hover:bg-surface-muted'}`}
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            onClick={() => setQuickRange('30')}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold ${quickRange === '30' ? 'bg-primary text-white' : 'border border-border text-text-secondary hover:bg-surface-muted'}`}
          >
            Últimos 30 días
          </button>
          <button
            type="button"
            onClick={() => setQuickRange('custom')}
            className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-semibold ${quickRange === 'custom' ? 'bg-primary text-white' : 'border border-border text-text-secondary hover:bg-surface-muted'}`}
          >
            <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.75} />
            Rango
          </button>
        </div>

        {quickRange === 'custom' && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(event) => setCustomStart(event.target.value)}
              className="h-10 flex-1 rounded-lg border border-border bg-white px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-sm text-text-caption">a</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={toISODate(new Date())}
              onChange={(event) => setCustomEnd(event.target.value)}
              className="h-10 flex-1 rounded-lg border border-border bg-white px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </div>
        )}

        {summary && (
          <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl border border-border p-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{summary.percentage}%</p>
              <p className="text-xs text-text-caption">Adherencia</p>
            </div>
            <div>
              <p className="text-lg font-bold text-secondary">{summary.taken}</p>
              <p className="text-xs text-text-caption">Tomadas</p>
            </div>
            <div>
              <p className="text-lg font-bold text-warning">{summary.skipped}</p>
              <p className="text-xs text-text-caption">Omitidas</p>
            </div>
            <div>
              <p className="text-lg font-bold text-danger-strong">{summary.missed}</p>
              <p className="text-xs text-text-caption">No tomadas</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {!doses && !error && <p className="text-sm text-text-caption">Cargando…</p>}
          {doses?.length === 0 && <p className="text-sm text-text-caption">No hay dosis registradas en este rango.</p>}
          {doses?.map((dose) => {
            const status = STATUS_LABELS[dose.status];
            return (
              <div key={dose.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold text-text">{dose.medicationName}</p>
                  <p className="text-xs text-text-caption">
                    {formatFullDate(dose.scheduledAt)} · {formatTime(dose.scheduledAt)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
