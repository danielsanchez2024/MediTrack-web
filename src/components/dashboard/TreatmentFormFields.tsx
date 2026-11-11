import type { FrequencyUnit } from '../../lib/api';
import { toDatetimeLocalValue } from '../../lib/date';

// A real prescription always says one or the other — "por 5 días" or "de uso continuo" — it's
// never left unstated. null means neither has been chosen yet: the form starts this way for a
// brand-new treatment specifically so a blank field can't silently mean "continuous" just
// because nobody thought about it.
export type DurationType = 'DEFINED' | 'CONTINUOUS';

export interface TreatmentFormValues {
  medicationName: string;
  // Split instead of one free-text "Dosis" field so it's never ambiguous which part is which
  // — "1 tableta" (how much to take) vs. "50mg" (the medication's own strength) are different
  // facts, and conflating them into one blob is exactly what made the strength easy to drop
  // silently when it came from a scan. Combined into a single "1 tableta (50mg)" string only
  // at submit time, since that's still the one field the backend stores.
  dosageAmount: string;
  dosageStrength: string;
  frequencyValue: string;
  frequencyUnit: FrequencyUnit;
  firstDoseAt: string;
  firstDoseAlreadyTaken: boolean;
  durationType: DurationType | null;
  // How many days the treatment lasts, counted from firstDoseAt — matches how a real
  // prescription phrases it ("por 5 días") instead of making the user compute a calendar
  // date. Converted to the endDate the backend actually expects right before submitting.
  // Only meaningful when durationType is 'DEFINED'.
  durationDays: string;
  instructions: string;
  totalQuantity: string;
  quantityPerDose: string;
}

export function emptyTreatmentFormValues(): TreatmentFormValues {
  return {
    medicationName: '',
    dosageAmount: '',
    dosageStrength: '',
    frequencyValue: '8',
    // Defaults to hours, since that's what almost every real prescription is phrased in — but
    // a bare number is genuinely ambiguous (12 minutes? hours? days?), so the unit is always
    // explicit instead of assumed.
    frequencyUnit: 'HOURS',
    // Defaults to right now, but is editable — e.g. "ya se tomó la primera dosis a las 7am" —
    // so the every-N schedule is anchored to when the first dose really happens instead of
    // whatever moment this form happens to be filled out.
    firstDoseAt: toDatetimeLocalValue(new Date()),
    firstDoseAlreadyTaken: false,
    durationType: null,
    durationDays: '',
    instructions: '',
    // Both optional — leaving quantity blank keeps the old behavior (schedule purely off the
    // rolling time window, no cap). Set it and the backend stops generating new doses once the
    // real supply runs out, instead of scheduling pills that don't exist.
    totalQuantity: '',
    quantityPerDose: '1'
  };
}

// A duration "choice" only really counts once it's actionable — DEFINED still needs the
// actual number of days before there's anything to submit.
export function isDurationChosen(values: TreatmentFormValues): boolean {
  if (values.durationType === 'DEFINED') return values.durationDays.trim() !== '';
  return values.durationType === 'CONTINUOUS';
}

// Computed fresh from the current values every time, rather than stored as a flag set once
// when a draft is created — a flag like that goes stale the moment the user types into the
// very field that made it incomplete, and then never clears even after they've fixed it.
export function isDraftIncomplete(values: TreatmentFormValues): boolean {
  return !values.medicationName.trim() || !values.dosageAmount.trim() || !values.frequencyValue || !isDurationChosen(values);
}

// The backend only ever stores one "dosage" string — this is the one place that decides how
// the two visual fields collapse into it, so every screen that saves a treatment agrees on
// the exact same format ("1 tableta (50mg)").
export function combineDosage(amount: string, strength: string): string {
  const trimmedAmount = amount.trim();
  const trimmedStrength = strength.trim();
  return trimmedStrength ? `${trimmedAmount} (${trimmedStrength})` : trimmedAmount;
}

// Reverses combineDosage — splits a stored dosage like "1 tableta (50mg)" back into its two
// parts so a scanned draft or an existing treatment can be edited as two clear fields again,
// instead of as one blob the user has to parse themselves.
export function splitDosage(dosage: string): { amount: string; strength: string } {
  const match = dosage.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (match) {
    return { amount: match[1].trim(), strength: match[2].trim() };
  }
  return { amount: dosage.trim(), strength: '' };
}

const UNIT_OPTIONS: { value: FrequencyUnit; label: string }[] = [
  { value: 'MINUTES', label: 'minutos' },
  { value: 'HOURS', label: 'horas' },
  { value: 'DAYS', label: 'días' }
];

interface TreatmentFormFieldsProps {
  values: TreatmentFormValues;
  onChange: <K extends keyof TreatmentFormValues>(field: K, value: TreatmentFormValues[K]) => void;
}

export default function TreatmentFormFields({ values, onChange }: TreatmentFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="medicationName" className="text-sm font-semibold text-text">
          Medicamento
        </label>
        <input
          id="medicationName"
          type="text"
          required
          placeholder="Ej. Losartán"
          value={values.medicationName}
          onChange={(event) => onChange('medicationName', event.target.value)}
          className="h-12 w-full rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dosageAmount" className="text-sm font-semibold text-text">
            Cantidad a tomar
          </label>
          <input
            id="dosageAmount"
            type="text"
            required
            placeholder="Ej. 1 tableta"
            value={values.dosageAmount}
            onChange={(event) => onChange('dosageAmount', event.target.value)}
            className="h-12 w-full rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dosageStrength" className="text-sm font-semibold text-text">
            Gramaje (opcional)
          </label>
          <input
            id="dosageStrength"
            type="text"
            placeholder="Ej. 50mg"
            value={values.dosageStrength}
            onChange={(event) => onChange('dosageStrength', event.target.value)}
            className="h-12 w-full rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="frequencyValue" className="text-sm font-semibold text-text">
          Frecuencia
        </label>
        <div className="flex gap-2">
          <input
            id="frequencyValue"
            type="number"
            required
            min={1}
            value={values.frequencyValue}
            onChange={(event) => onChange('frequencyValue', event.target.value)}
            className="h-12 w-24 rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <select
            id="frequencyUnit"
            aria-label="Unidad de la frecuencia"
            value={values.frequencyUnit}
            onChange={(event) => onChange('frequencyUnit', event.target.value as FrequencyUnit)}
            className="h-12 flex-1 rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-text-caption">
          Ej. "cada 12 horas" y "cada 12 minutos" son cosas muy distintas — elige la unidad con
          cuidado.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="firstDoseAt" className="text-sm font-semibold text-text">
          ¿Cuándo es (o fue) la primera dosis?
        </label>
        <input
          id="firstDoseAt"
          type="datetime-local"
          required
          // Only restricted when it's not a dose that already happened. The floor sits an hour
          // back, not at "now": the default value is stamped when the form opens, and a moving
          // "now" floor would make the browser itself block saving a form left open a few
          // minutes. A slightly stale value is moved up to the saving moment (see
          // effectiveFirstDoseAt in lib/treatmentDrafts.ts).
          min={values.firstDoseAlreadyTaken ? undefined : toDatetimeLocalValue(new Date(Date.now() - 60 * 60_000))}
          value={values.firstDoseAt}
          onChange={(event) => onChange('firstDoseAt', event.target.value)}
          className="h-12 w-full rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <label className="mt-1 flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted p-3 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={values.firstDoseAlreadyTaken}
            onChange={(event) => onChange('firstDoseAlreadyTaken', event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            Esta primera dosis ya se tomó a esa hora — quedará registrada como tomada y las
            siguientes se calculan a partir de ahí.
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-text">Duración del tratamiento</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange('durationType', 'DEFINED')}
            aria-pressed={values.durationType === 'DEFINED'}
            className={`flex h-12 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors ${
              values.durationType === 'DEFINED'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-text-secondary hover:bg-surface-muted'
            }`}
          >
            Duración definida
          </button>
          <button
            type="button"
            onClick={() => onChange('durationType', 'CONTINUOUS')}
            aria-pressed={values.durationType === 'CONTINUOUS'}
            className={`flex h-12 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors ${
              values.durationType === 'CONTINUOUS'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-text-secondary hover:bg-surface-muted'
            }`}
          >
            Continuo / crónico
          </button>
        </div>

        {values.durationType === 'DEFINED' && (
          <div className="mt-1 flex items-center gap-2">
            <input
              id="durationDays"
              type="number"
              required
              min={1}
              autoFocus
              placeholder="Ej. 5"
              value={values.durationDays}
              onChange={(event) => onChange('durationDays', event.target.value)}
              className="h-12 w-28 rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-sm text-text-secondary">días, como dice la fórmula — "por 5 días"</span>
          </div>
        )}
        {values.durationType === 'CONTINUOUS' && (
          <p className="text-xs text-text-caption">
            No se generará una fecha de fin — las tomas se siguen programando hasta que
            desactives el tratamiento.
          </p>
        )}
        {values.durationType === null && (
          <p className="text-xs font-medium text-warning">Elige una de las dos opciones.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="instructions" className="text-sm font-semibold text-text">
          Instrucciones (opcional)
        </label>
        <textarea
          id="instructions"
          rows={2}
          placeholder="Ej. Tomar con medio vaso de agua después del desayuno"
          value={values.instructions}
          onChange={(event) => onChange('instructions', event.target.value)}
          className="w-full resize-none rounded-lg border border-border bg-white p-3 text-sm text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="totalQuantity" className="text-sm font-semibold text-text">
          Cantidad suministrada (opcional)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="totalQuantity"
            type="number"
            min={1}
            placeholder="Ej. 30"
            value={values.totalQuantity}
            onChange={(event) => onChange('totalQuantity', event.target.value)}
            className="h-12 w-28 rounded-lg border border-border bg-white px-4 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {values.totalQuantity && (
            <>
              <span className="text-sm text-text-secondary">unidades, </span>
              <input
                type="number"
                min={1}
                aria-label="Cantidad por toma"
                value={values.quantityPerDose}
                onChange={(event) => onChange('quantityPerDose', event.target.value)}
                className="h-12 w-16 rounded-lg border border-border bg-white px-3 text-center text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm text-text-secondary">por toma</span>
            </>
          )}
        </div>
        <p className="text-xs text-text-caption">
          Si la sabes, deja de generarse el horario cuando se acabe — como una receta real que
          se termina. Déjalo en blanco para no llevar el conteo.
        </p>
      </div>
    </div>
  );
}
