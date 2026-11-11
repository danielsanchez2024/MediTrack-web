import { useState } from 'react';
import { X, Pill, Clock, User, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { updateDoseStatus, ApiError, type ScheduledDose, type DoseStatus, type RecordableStatus } from '../../lib/api';
import { toSpanishMessage } from '../../lib/errorMessages';
import { formatTime, formatFullDate } from '../../lib/date';

const STATUS_LABEL: Record<DoseStatus, string> = {
  PENDING: 'Pendiente',
  TAKEN: 'Tomada',
  SKIPPED: 'Omitida',
  MISSED: 'Perdida'
};

interface DoseDetailModalProps {
  profileId: string;
  dose: ScheduledDose;
  onClose: () => void;
  onCorrected: (updated: ScheduledDose) => void;
}

// Only shown for a dose that's already been recorded (TAKEN/SKIPPED) — a PENDING one is
// still recorded through the normal card, this is specifically the "I made a mistake" path,
// and only while ScheduledDoseService.updateStatus still accepts a correction for it
// (dose.correctable — a short grace period after recordedAt, not an open-ended edit).
export default function DoseDetailModal({ profileId, dose, onClose, onCorrected }: DoseDetailModalProps) {
  const [notes, setNotes] = useState(dose.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCorrect(status: RecordableStatus) {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDoseStatus(profileId, dose.id, { status, notes: notes || undefined });
      onCorrected(updated);
    } catch (err) {
      setError(err instanceof ApiError ? toSpanishMessage(err.message) : 'No pudimos guardar la corrección.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">{dose.medicationName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        <p className="mt-1 text-sm text-text-secondary">{dose.dosage}</p>
        {dose.instructions && <p className="mt-1 text-sm italic text-text-caption">{dose.instructions}</p>}
        {dose.remainingQuantity !== null && (
          <p className="mt-1 text-xs font-semibold text-text-caption">
            Quedan {dose.remainingQuantity} unidad{dose.remainingQuantity === 1 ? '' : 'es'} de este
            medicamento
          </p>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
          <Clock className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
          Programada: {formatFullDate(dose.scheduledAt)} · {formatTime(dose.scheduledAt)}
        </div>

        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-text-secondary">
          {STATUS_LABEL[dose.status]}
        </div>

        {dose.status !== 'PENDING' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
            <User className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
            {dose.recordedAt && formatTime(dose.recordedAt)}
            {dose.recordedByName ? ` · registrado por ${dose.recordedByName}` : ''}
          </div>
        )}

        {dose.notes && dose.status !== 'PENDING' && (
          <p className="mt-2 rounded-lg bg-surface-muted p-3 text-sm text-text-secondary">"{dose.notes}"</p>
        )}

        {dose.status === 'MISSED' && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            Se marcó como perdida automáticamente porque pasó demasiado tiempo sin registrarse.
            Puedes corregirla si en realidad sí se tomó.
          </div>
        )}

        {dose.status !== 'PENDING' && (
          <div className="mt-5 border-t border-border pt-4">
            {dose.correctable ? (
              <>
                <p className="text-sm font-semibold text-text">¿Se registró mal esta toma?</p>
                <p className="mt-1 text-xs text-text-caption">
                  {dose.status === 'MISSED'
                    ? 'Puedes corregirla cuando quieras.'
                    : 'Puedes corregirla hasta 15 minutos después de haberla registrado.'}
                </p>

                {error && (
                  <div role="alert" className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-strong">
                    {error}
                  </div>
                )}

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observaciones"
                  rows={2}
                  className="mt-3 w-full resize-none rounded-lg border border-border bg-white p-3 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  {dose.status !== 'TAKEN' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleCorrect('TAKEN')}
                      className="h-10 flex-1 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Marcar como tomada
                    </button>
                  )}
                  {dose.status !== 'SKIPPED' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleCorrect('SKIPPED')}
                      className="h-10 flex-1 rounded-lg border border-border px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Marcar como omitida
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleCorrect('PENDING')}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                    title="Deshacer y volver a pendiente"
                  >
                    <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
                    Deshacer
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2 text-sm text-text-caption">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
                Ya pasaron más de 15 minutos desde que se registró — este registro ya no se puede
                corregir.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
