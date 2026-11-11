import { Plus, X } from 'lucide-react';
import type { TreatmentDraft } from '../../lib/treatmentDrafts';
import { isDraftIncomplete } from './TreatmentFormFields';

interface TreatmentDraftTabsProps {
  drafts: TreatmentDraft[];
  activeKey: string;
  onSelect: (key: string) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}

export default function TreatmentDraftTabs({ drafts, activeKey, onSelect, onAdd, onRemove }: TreatmentDraftTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {drafts.map((draft, index) => {
        const label = draft.values.medicationName.trim() || `Medicamento ${index + 1}`;
        const isActive = draft.key === activeKey;
        const needsAttention = Boolean(draft.error || isDraftIncomplete(draft.values));

        return (
          <div
            key={draft.key}
            className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1.5 text-sm font-semibold transition-colors ${
              isActive ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-secondary hover:bg-surface-muted'
            }`}
          >
            <button type="button" onClick={() => onSelect(draft.key)} className="flex max-w-[9rem] items-center gap-1.5">
              {needsAttention && (
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${draft.error ? 'bg-danger' : isActive ? 'bg-white' : 'bg-warning'}`}
                />
              )}
              <span className="truncate">{label}</span>
            </button>
            {drafts.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(draft.key)}
                aria-label={`Quitar ${label}`}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  isActive ? 'text-white/80 hover:text-white' : 'text-text-muted hover:text-danger-strong'
                }`}
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm font-semibold text-primary hover:bg-surface-muted"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Agregar
      </button>
    </div>
  );
}
