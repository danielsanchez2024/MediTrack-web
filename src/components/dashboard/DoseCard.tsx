import { useState } from 'react';
import { CheckCircle2, Clock, Lock, X, Info, Hourglass, AlertTriangle } from 'lucide-react';
import type { ScheduledDose } from '../../lib/api';
import { formatTime } from '../../lib/date';

// Must match ScheduledDoseService.EARLY_RECORDING_BUFFER_MINUTES on the backend, which is
// what actually enforces this — this copy only decides when to show the countdown vs. the
// real action buttons between fetches (the backend's own `recordable` field only reflects
// the instant it was fetched, and doesn't tick live the way this component needs to).
const EARLY_RECORDING_BUFFER_MINUTES = 10;

interface DoseCardProps {
  dose: ScheduledDose;
  isActionable: boolean;
  now: Date;
  onRecord: (status: 'TAKEN' | 'SKIPPED', notes: string) => void;
  onViewDetail: () => void;
  saving: boolean;
}

function ViewDetailButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
    >
      <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
      Ver detalle
    </button>
  );
}

export default function DoseCard({ dose, isActionable, now, onRecord, onViewDetail, saving }: DoseCardProps) {
  const [notes, setNotes] = useState('');
  const minutesUntilScheduled = (new Date(dose.scheduledAt).getTime() - now.getTime()) / 60000;
  const isRecordable = minutesUntilScheduled <= EARLY_RECORDING_BUFFER_MINUTES;
  // Ticks true the instant scheduledAt passes — driven by the same live clock as the
  // countdown above it, not by a backend fetch, so it changes the moment it's actually true
  // rather than up to a minute later on the next poll.
  const isOverdue = minutesUntilScheduled < 0;
  const minutesOverdue = Math.round(-minutesUntilScheduled);

  if (dose.status === 'TAKEN' || dose.status === 'SKIPPED') {
    const taken = dose.status === 'TAKEN';
    return (
      <div
        className={`flex gap-3 rounded-xl border p-4 ${
          taken ? 'border-success-soft bg-surface-card' : 'border-warning-bg-soft bg-surface-card'
        }`}
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            taken ? 'bg-secondary' : 'bg-warning'
          }`}
        >
          {taken ? (
            <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2} />
          ) : (
            <X className="h-5 w-5 text-white" strokeWidth={2} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-text">{dose.medicationName}</h3>
            <span className="text-sm font-semibold text-text-caption">{formatTime(dose.scheduledAt)}</span>
          </div>
          <p className="text-sm text-text-secondary">{dose.dosage}</p>
          {dose.instructions && <p className="mt-1 text-sm italic text-text-caption">{dose.instructions}</p>}
          <div
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              taken ? 'bg-success-bg text-secondary' : 'bg-warning-bg text-warning'
            }`}
          >
            {taken ? '✓ Tomada' : 'Omitida'} a las {dose.recordedAt ? formatTime(dose.recordedAt) : ''}
            {dose.recordedByName ? ` · registrado por ${dose.recordedByName}` : ''}
          </div>
          {dose.notes && <p className="mt-2 text-sm text-text-secondary">"{dose.notes}"</p>}
          <ViewDetailButton onClick={onViewDetail} />
        </div>
      </div>
    );
  }

  if (dose.status === 'MISSED') {
    return (
      <div className="flex gap-3 rounded-xl border border-danger-bg-soft bg-surface-card p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger">
          <AlertTriangle className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-text">{dose.medicationName}</h3>
            <span className="text-sm font-semibold text-text-caption">{formatTime(dose.scheduledAt)}</span>
          </div>
          <p className="text-sm text-text-secondary">{dose.dosage}</p>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-1 text-xs font-semibold text-danger-strong">
            Perdida — no se registró a tiempo
          </div>
          <ViewDetailButton onClick={onViewDetail} />
        </div>
      </div>
    );
  }

  if (!isActionable) {
    return (
      <div className="flex gap-3 rounded-xl border border-border bg-surface-muted p-4 opacity-75">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-border">
          <Lock className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-text-secondary">{dose.medicationName}</h3>
            <span className="text-sm font-semibold text-text-caption">{formatTime(dose.scheduledAt)}</span>
          </div>
          <p className="text-sm text-text-muted">{dose.dosage}</p>
          <p className="mt-2 text-xs text-text-caption">
            Se habilitará cuando se resuelva la dosis anterior de este medicamento.
          </p>
          <ViewDetailButton onClick={onViewDetail} />
        </div>
      </div>
    );
  }

  if (!isRecordable) {
    const minutesLeft = Math.max(1, Math.ceil(minutesUntilScheduled));
    return (
      <div className="flex gap-3 rounded-xl border border-border-strong bg-surface-info p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Hourglass className="h-4 w-4 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-text">{dose.medicationName}</h3>
            <span className="text-sm font-semibold text-text-caption">{formatTime(dose.scheduledAt)}</span>
          </div>
          <p className="text-sm text-text-secondary">{dose.dosage}</p>
          <p className="mt-2 text-xs font-semibold text-primary">
            Disponible en {minutesLeft} {minutesLeft === 1 ? 'minuto' : 'minutos'}
          </p>
          <ViewDetailButton onClick={onViewDetail} />
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border-2 bg-surface-card ${isOverdue ? 'border-warning' : 'border-primary'}`}>
      <div
        className={`px-4 py-1.5 text-xs font-bold tracking-wide text-white uppercase ${
          isOverdue ? 'bg-warning' : 'bg-primary'
        }`}
      >
        {isOverdue ? 'Dosis atrasada' : 'Dosis pendiente actual'}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold text-text">{dose.medicationName}</h3>
          <span className="flex items-center gap-1 text-sm font-semibold text-text-caption">
            <Clock className="h-4 w-4" strokeWidth={1.75} />
            {formatTime(dose.scheduledAt)}
          </span>
        </div>
        <p className="text-sm text-text-secondary">{dose.dosage}</p>
        {dose.instructions && <p className="mt-1 text-sm italic text-text-caption">{dose.instructions}</p>}
        {isOverdue ? (
          <p className="mt-2 text-xs font-semibold text-warning">
            Atrasada por {minutesOverdue} {minutesOverdue === 1 ? 'minuto' : 'minutos'} — igual puedes registrarla.
          </p>
        ) : (
          !dose.withinWindow && (
            <p className="mt-2 text-xs font-medium text-warning">
              Fuera de la ventana habitual (±45 min) — igual puedes registrarla.
            </p>
          )
        )}

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Observaciones (opcional): ¿cómo le fue con esta toma?"
          rows={2}
          className="mt-3 w-full resize-none rounded-lg border border-border bg-white p-3 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => onRecord('TAKEN', notes)}
            className="flex h-12 flex-1 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            ✓ Marcar como tomada
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onRecord('SKIPPED', notes)}
            className="flex h-12 items-center justify-center rounded-lg border border-border px-4 text-[15px] font-semibold text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            ✗ Omitida
          </button>
        </div>
        <ViewDetailButton onClick={onViewDetail} />
      </div>
    </div>
  );
}
