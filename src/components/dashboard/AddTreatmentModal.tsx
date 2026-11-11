import { useState, type FormEvent } from 'react';
import { X, Pill, AlertTriangle } from 'lucide-react';
import { submitDrafts, emptyDraft, type TreatmentDraft } from '../../lib/treatmentDrafts';
import TreatmentFormFields, { isDraftIncomplete, type TreatmentFormValues } from './TreatmentFormFields';
import TreatmentDraftTabs from './TreatmentDraftTabs';

interface AddTreatmentModalProps {
  profileId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddTreatmentModal({ profileId, onClose, onCreated }: AddTreatmentModalProps) {
  const [firstDraft] = useState(emptyDraft);
  const [drafts, setDrafts] = useState<TreatmentDraft[]>([firstDraft]);
  const [activeKey, setActiveKey] = useState(firstDraft.key);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const activeDraft = drafts.find((draft) => draft.key === activeKey) ?? drafts[0];

  function handleChange<K extends keyof TreatmentFormValues>(field: K, value: TreatmentFormValues[K]) {
    setDrafts((current) =>
      current.map((draft) => (draft.key === activeDraft.key ? { ...draft, values: { ...draft.values, [field]: value } } : draft))
    );
  }

  function handleAdd() {
    const draft = emptyDraft();
    setDrafts((current) => [...current, draft]);
    setActiveKey(draft.key);
  }

  function handleRemove(key: string) {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.key !== key);
      if (activeKey === key && next.length > 0) setActiveKey(next[0].key);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    setSaving(true);
    const { succeededCount, failedDrafts, total } = await submitDrafts(profileId, drafts, false);
    setSaving(false);

    if (succeededCount > 0) onCreated();

    if (failedDrafts.length === 0) {
      onClose();
      return;
    }

    setDrafts(failedDrafts);
    setActiveKey(failedDrafts[0].key);
    setBanner(
      succeededCount > 0
        ? `Se agregó${succeededCount === 1 ? '' : 'n'} ${succeededCount} de ${total} medicamento${succeededCount === 1 ? '' : 's'}. Revisa el${failedDrafts.length === 1 ? '' : 'os'} que falló${failedDrafts.length === 1 ? '' : 'aron'}.`
        : null
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Agregar medicamento</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        <p className="mt-1 text-sm text-text-caption">
          ¿La fórmula trae más de uno? Agrégalos todos aquí para planearlos juntos.
        </p>

        {banner && (
          <div role="alert" className="mt-4 rounded-lg bg-warning-bg px-4 py-3 text-sm font-medium text-warning">
            {banner}
          </div>
        )}

        <div className="mt-4">
          <TreatmentDraftTabs drafts={drafts} activeKey={activeDraft.key} onSelect={setActiveKey} onAdd={handleAdd} onRemove={handleRemove} />
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
          {activeDraft.error && (
            <div role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong">
              {activeDraft.error}
            </div>
          )}
          {isDraftIncomplete(activeDraft.values) && !activeDraft.error && (
            <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2.5 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>Completa medicamento, cantidad, frecuencia y duración antes de guardar.</span>
            </div>
          )}

          <TreatmentFormFields values={activeDraft.values} onChange={handleChange} />

          <button
            type="submit"
            disabled={saving}
            className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando…' : `Agregar ${drafts.length} medicamento${drafts.length === 1 ? '' : 's'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
