import { useEffect, useState, type FormEvent } from 'react';
import { X, Pill, Pencil, Ban, ScanLine, PenLine, Info } from 'lucide-react';
import {
  getTreatments,
  getInactiveTreatments,
  updateTreatment,
  deactivateTreatment,
  ApiError,
  type Treatment,
  type FrequencyUnit
} from '../../lib/api';
import { toSpanishMessage, toSpanishMessages } from '../../lib/errorMessages';
import { formatFrequency, addDaysToDateString, formatDateOnly } from '../../lib/date';
import { combineDosage, splitDosage, type DurationType } from './TreatmentFormFields';
import MedicationInfoModal from './MedicationInfoModal';

interface ManageTreatmentsModalProps {
  profileId: string;
  onClose: () => void;
  onChanged: () => void;
}

const UNIT_OPTIONS: { value: FrequencyUnit; label: string }[] = [
  { value: 'MINUTES', label: 'minutos' },
  { value: 'HOURS', label: 'horas' },
  { value: 'DAYS', label: 'días' }
];

interface EditValues {
  dosageAmount: string;
  dosageStrength: string;
  frequencyValue: string;
  frequencyUnit: FrequencyUnit;
  durationType: DurationType;
  durationDays: string;
  instructions: string;
}

// Calendar-day difference between the treatment's first dose and its end date — shown as
// "días" (matching how a prescription phrases it) instead of making the caregiver read a raw
// date back out and do the subtraction themselves.
function daysBetween(startIso: string, endDate: string): number {
  const start = new Date(startIso);
  const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end.getTime() - startOfDay.getTime()) / (24 * 60 * 60 * 1000));
}

function editValuesFrom(treatment: Treatment): EditValues {
  const { amount, strength } = splitDosage(treatment.dosage);
  return {
    dosageAmount: amount,
    dosageStrength: strength,
    frequencyValue: String(treatment.frequencyValue),
    frequencyUnit: treatment.frequencyUnit,
    durationType: treatment.endDate ? 'DEFINED' : 'CONTINUOUS',
    durationDays: treatment.endDate ? String(daysBetween(treatment.startDate, treatment.endDate)) : '',
    instructions: treatment.instructions ?? ''
  };
}

type View = 'active' | 'history';

export default function ManageTreatmentsModal({ profileId, onClose, onChanged }: ManageTreatmentsModalProps) {
  const [view, setView] = useState<View>('active');
  const [treatments, setTreatments] = useState<Treatment[] | null>(null);
  const [historyTreatments, setHistoryTreatments] = useState<Treatment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [infoMedicationId, setInfoMedicationId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTreatments(profileId)
      .then((result) => {
        if (!cancelled) setTreatments(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError('No pudimos cargar los tratamientos.');
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (view !== 'history' || historyTreatments !== null) return;
    let cancelled = false;
    getInactiveTreatments(profileId)
      .then((result) => {
        if (!cancelled) setHistoryTreatments(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError('No pudimos cargar el historial.');
      });
    return () => {
      cancelled = true;
    };
  }, [view, profileId, historyTreatments]);

  function startEdit(treatment: Treatment) {
    setRowError(null);
    setConfirmingDeactivateId(null);
    setEditingId(treatment.id);
    setEditValues(editValuesFrom(treatment));
  }

  function handleEditChange<K extends keyof EditValues>(field: K, value: EditValues[K]) {
    setEditValues((current) => (current ? { ...current, [field]: value } : current));
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !editValues) return;
    const editingTreatment = treatments?.find((item) => item.id === editingId);
    if (!editingTreatment) return;
    setRowError(null);
    setSaving(true);
    try {
      const updated = await updateTreatment(profileId, editingId, {
        dosage: combineDosage(editValues.dosageAmount, editValues.dosageStrength),
        frequencyValue: Number(editValues.frequencyValue),
        frequencyUnit: editValues.frequencyUnit,
        endDate:
          editValues.durationType === 'DEFINED'
            ? addDaysToDateString(editingTreatment.startDate, Number(editValues.durationDays))
            : undefined,
        clearEndDate: editValues.durationType === 'CONTINUOUS',
        // Always sent: an emptied field is how the user removes the instructions (the backend
        // treats a blank string as "clear" and an omitted one as "unchanged").
        instructions: editValues.instructions.trim()
      });
      setTreatments((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      setEditingId(null);
      setEditValues(null);
      onChanged();
    } catch (error) {
      setRowError({
        id: editingId,
        message:
          error instanceof ApiError
            ? error.details.length > 0
              ? toSpanishMessages(error.details)
              : toSpanishMessage(error.message)
            : 'No pudimos guardar los cambios.'
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(treatmentId: string) {
    setRowError(null);
    setDeactivatingId(treatmentId);
    try {
      await deactivateTreatment(profileId, treatmentId);
      setTreatments((current) => current?.filter((item) => item.id !== treatmentId) ?? null);
      // Forces a refetch next time the history tab is opened, so the treatment that just
      // moved out of "active" shows up there without the caregiver having to close and
      // reopen this whole modal.
      setHistoryTreatments(null);
      setConfirmingDeactivateId(null);
      onChanged();
    } catch (error) {
      setRowError({
        id: treatmentId,
        message: error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos desactivar el tratamiento.'
      });
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Mis tratamientos</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setView('active')}
            className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${
              view === 'active' ? 'bg-primary text-white' : 'border border-border text-text-secondary hover:bg-surface-muted'
            }`}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${
              view === 'history' ? 'bg-primary text-white' : 'border border-border text-text-secondary hover:bg-surface-muted'
            }`}
          >
            Historial
          </button>
        </div>

        {loadError && (
          <div role="alert" className="mt-4 rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong">
            {loadError}
          </div>
        )}

        {view === 'history' ? (
          <div className="mt-4 flex flex-col gap-3">
            {historyTreatments === null && !loadError && <p className="text-sm text-text-caption">Cargando…</p>}
            {historyTreatments?.length === 0 && (
              <p className="text-sm text-text-caption">No hay tratamientos desactivados.</p>
            )}
            {historyTreatments?.map((treatment) => (
              <div key={treatment.id} className="rounded-xl border border-border bg-surface-muted p-4 opacity-80">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 font-semibold text-text-secondary">
                    {treatment.medicationName}
                    <button
                      type="button"
                      onClick={() => setInfoMedicationId(treatment.medicationId)}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-text-muted hover:bg-surface-card hover:text-primary"
                      aria-label={`Ver información de ${treatment.medicationName}`}
                    >
                      <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </p>
                  <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-bold text-text-caption">
                    Desactivado
                  </span>
                </div>
                <p className="text-sm text-text-caption">
                  {treatment.dosage} · {formatFrequency(treatment.frequencyValue, treatment.frequencyUnit)}
                  {treatment.endDate ? ` · hasta el ${formatDateOnly(treatment.endDate)}` : ''}
                </p>
                {treatment.instructions && (
                  <p className="mt-1 text-xs italic text-text-caption">{treatment.instructions}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
        <div className="mt-4 flex flex-col gap-3">
          {treatments === null && !loadError && <p className="text-sm text-text-caption">Cargando…</p>}
          {treatments?.length === 0 && <p className="text-sm text-text-caption">No hay tratamientos activos.</p>}

          {treatments?.map((treatment) => {
            const isEditing = editingId === treatment.id;
            const error = rowError?.id === treatment.id ? rowError.message : null;

            return (
              <div key={treatment.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 font-semibold text-text">
                      {treatment.medicationName}
                      <span
                        className="flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-text-caption"
                        title={treatment.registrationSource === 'SCAN' ? 'Agregado por escaneo de fórmula' : 'Agregado manualmente'}
                      >
                        {treatment.registrationSource === 'SCAN' ? (
                          <ScanLine className="h-3 w-3" strokeWidth={1.75} />
                        ) : (
                          <PenLine className="h-3 w-3" strokeWidth={1.75} />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setInfoMedicationId(treatment.medicationId)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted hover:text-primary"
                        aria-label={`Ver información de ${treatment.medicationName}`}
                      >
                        <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </p>
                    <p className="text-sm text-text-secondary">
                      {treatment.dosage} · {formatFrequency(treatment.frequencyValue, treatment.frequencyUnit)}
                      {treatment.endDate ? ` · hasta el ${formatDateOnly(treatment.endDate)}` : ''}
                    </p>
                    {treatment.instructions && (
                      <p className="mt-1 text-xs italic text-text-caption">{treatment.instructions}</p>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(treatment)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-muted"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeactivateId(treatment.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger-bg-soft text-danger-strong hover:bg-danger-bg"
                        aria-label="Desactivar"
                      >
                        <Ban className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div role="alert" className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
                    {error}
                  </div>
                )}

                {confirmingDeactivateId === treatment.id && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-warning-bg px-3 py-2.5">
                    <p className="text-xs text-warning">
                      No se borra del historial, pero deja de generar tomas nuevas. ¿Desactivar?
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeactivateId(null)}
                        className="h-8 rounded-lg border border-border px-3 text-xs font-semibold text-text-secondary hover:bg-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={deactivatingId === treatment.id}
                        onClick={() => handleDeactivate(treatment.id)}
                        className="h-8 rounded-lg bg-danger-strong px-3 text-xs font-semibold text-white hover:bg-danger disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deactivatingId === treatment.id ? 'Desactivando…' : 'Sí, desactivar'}
                      </button>
                    </div>
                  </div>
                )}

                {isEditing && editValues && (
                  <form onSubmit={handleSaveEdit} className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text">Cantidad a tomar</label>
                        <input
                          type="text"
                          required
                          value={editValues.dosageAmount}
                          onChange={(event) => handleEditChange('dosageAmount', event.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text">Gramaje (opcional)</label>
                        <input
                          type="text"
                          value={editValues.dosageStrength}
                          onChange={(event) => handleEditChange('dosageStrength', event.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text">Frecuencia</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          required
                          min={1}
                          value={editValues.frequencyValue}
                          onChange={(event) => handleEditChange('frequencyValue', event.target.value)}
                          className="h-10 w-20 rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        <select
                          value={editValues.frequencyUnit}
                          onChange={(event) => handleEditChange('frequencyUnit', event.target.value as FrequencyUnit)}
                          className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                          {UNIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-text-caption">Cambiar esto reemplaza las tomas pendientes por el nuevo horario.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text">Duración del tratamiento</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditChange('durationType', 'DEFINED')}
                          className={`flex h-10 items-center justify-center rounded-lg border-2 text-xs font-semibold transition-colors ${
                            editValues.durationType === 'DEFINED'
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-text-secondary hover:bg-surface-muted'
                          }`}
                        >
                          Duración definida
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditChange('durationType', 'CONTINUOUS')}
                          className={`flex h-10 items-center justify-center rounded-lg border-2 text-xs font-semibold transition-colors ${
                            editValues.durationType === 'CONTINUOUS'
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-text-secondary hover:bg-surface-muted'
                          }`}
                        >
                          Continuo / crónico
                        </button>
                      </div>
                      {editValues.durationType === 'DEFINED' && (
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            required
                            min={1}
                            placeholder="Ej. 5"
                            value={editValues.durationDays}
                            onChange={(event) => handleEditChange('durationDays', event.target.value)}
                            className="h-10 w-24 rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                          <span className="text-sm text-text-secondary">días desde la primera dosis</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text">Instrucciones (opcional)</label>
                      <textarea
                        rows={2}
                        value={editValues.instructions}
                        onChange={(event) => handleEditChange('instructions', event.target.value)}
                        className="w-full resize-none rounded-lg border border-border bg-white p-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditValues(null);
                        }}
                        className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-text-secondary hover:bg-surface-muted"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {infoMedicationId && (
        <MedicationInfoModal medicationId={infoMedicationId} onClose={() => setInfoMedicationId(null)} />
      )}
    </div>
  );
}
