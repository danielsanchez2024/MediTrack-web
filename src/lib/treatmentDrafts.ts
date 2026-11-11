import { createTreatment, ApiError, type ScannedMedication, type TreatmentRequest } from './api';
import { toSpanishMessage, toSpanishMessages } from './errorMessages';
import { addDaysToDateString, toDatetimeLocalValue, toOffsetDateTimeValue } from './date';
import {
  emptyTreatmentFormValues,
  isDurationChosen,
  combineDosage,
  splitDosage,
  type TreatmentFormValues
} from '../components/dashboard/TreatmentFormFields';

export interface TreatmentDraft {
  key: string;
  values: TreatmentFormValues;
  error: string | null;
}

let keyCounter = 0;
function makeDraftKey(): string {
  keyCounter += 1;
  return `draft-${keyCounter}`;
}

export function emptyDraft(): TreatmentDraft {
  return { key: makeDraftKey(), values: emptyTreatmentFormValues(), error: null };
}

// Maps whatever the vision model managed to read into the same draft shape the manual form
// uses — any field it couldn't find stays blank (never guessed), so the tab for this
// medication shows a warning (via isDraftIncomplete, computed live from these values) until
// the user fills it in themselves.
export function draftFromScan(medication: ScannedMedication): TreatmentDraft {
  // Only pre-fills as DEFINED when the scan actually found a number of days — if it didn't,
  // that's genuinely ambiguous (never mentioned? continuous? just not legible?), so this
  // leaves durationType unset rather than guessing "continuous", the same forced choice a
  // manual entry starts with.
  const { amount, strength } = splitDosage(medication.dosage ?? '');
  const values: TreatmentFormValues = {
    ...emptyTreatmentFormValues(),
    medicationName: medication.medicationName ?? '',
    dosageAmount: amount,
    dosageStrength: strength,
    frequencyValue: medication.frequencyHours != null ? String(medication.frequencyHours) : '',
    frequencyUnit: 'HOURS',
    durationType: medication.durationDays != null ? 'DEFINED' : null,
    durationDays: medication.durationDays != null ? String(medication.durationDays) : ''
  };
  return { key: makeDraftKey(), values, error: null };
}

// The first-dose field defaults to "now" when the form opens, but the backend rejects a
// not-yet-taken first dose more than a minute in the past — so a form left open a while (a
// slow typist, reviewing a scan) would fail with "la fecha ya pasó" for a time the user never
// chose. A time that slipped into the recent past is moved up to the moment of saving; one
// clearly in the past is left alone so the backend's message still explains it.
const STALE_FIRST_DOSE_TOLERANCE_MS = 60 * 60_000;

function effectiveFirstDoseAt(values: TreatmentFormValues, now: Date = new Date()): string {
  if (values.firstDoseAlreadyTaken) return values.firstDoseAt;
  const chosen = new Date(values.firstDoseAt).getTime();
  const elapsed = now.getTime() - chosen;
  return elapsed > 0 && elapsed <= STALE_FIRST_DOSE_TOLERANCE_MS ? toDatetimeLocalValue(now) : values.firstDoseAt;
}

function payloadFrom(values: TreatmentFormValues, fromPrescriptionScan: boolean): TreatmentRequest {
  const firstDoseAt = effectiveFirstDoseAt(values);
  return {
    medicationName: values.medicationName,
    dosage: combineDosage(values.dosageAmount, values.dosageStrength),
    frequencyValue: Number(values.frequencyValue),
    frequencyUnit: values.frequencyUnit,
    startDate: toOffsetDateTimeValue(firstDoseAt),
    firstDoseAlreadyTaken: values.firstDoseAlreadyTaken,
    endDate:
      values.durationType === 'DEFINED'
        ? addDaysToDateString(firstDoseAt, Number(values.durationDays))
        : undefined,
    instructions: values.instructions || undefined,
    totalQuantity: values.totalQuantity ? Number(values.totalQuantity) : undefined,
    quantityPerDose: values.totalQuantity ? Number(values.quantityPerDose) : undefined,
    fromPrescriptionScan
  };
}

export function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.details.length > 0 ? toSpanishMessages(error.details) : toSpanishMessage(error.message);
  }
  return 'No pudimos conectar con el servidor.';
}

export interface SubmitDraftsResult {
  total: number;
  succeededCount: number;
  failedDrafts: TreatmentDraft[];
}

// Each draft is its own independent create call — one invalid or duplicate medication
// shouldn't throw away the others that were perfectly fine. Successful ones are created for
// real; only the ones that actually failed come back, with their own error attached, so the
// caller can show just those instead of starting over.
export async function submitDrafts(
  profileId: string,
  drafts: TreatmentDraft[],
  fromPrescriptionScan: boolean
): Promise<SubmitDraftsResult> {
  const results = await Promise.all(
    drafts.map(async (draft) => {
      if (!isDurationChosen(draft.values)) {
        return { draft, ok: false as const, message: 'Elige si el tratamiento tiene duración definida o es continuo.' };
      }
      try {
        await createTreatment(profileId, payloadFrom(draft.values, fromPrescriptionScan));
        return { draft, ok: true as const };
      } catch (error) {
        return { draft, ok: false as const, message: messageForError(error) };
      }
    })
  );

  const succeededCount = results.filter((result) => result.ok).length;
  const failedDrafts = results
    .filter((result): result is { draft: TreatmentDraft; ok: false; message: string } => !result.ok)
    .map((result) => ({ ...result.draft, error: result.message }));

  return { total: results.length, succeededCount, failedDrafts };
}
