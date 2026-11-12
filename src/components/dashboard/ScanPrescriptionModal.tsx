import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { X, Camera, ScanLine, AlertTriangle, Pencil, ShieldAlert, ShieldCheck } from 'lucide-react';
import { scanPrescription, getScanProviderInfo, ApiError, type ScanProviderInfo } from '../../lib/api';
import { prepareImageForUpload, type CropRect } from '../../lib/imageCrop';
import { submitDrafts, draftFromScan, emptyDraft, type TreatmentDraft } from '../../lib/treatmentDrafts';
import { toSpanishMessage } from '../../lib/errorMessages';
import TreatmentFormFields, { isDraftIncomplete, type TreatmentFormValues } from './TreatmentFormFields';
import TreatmentDraftTabs from './TreatmentDraftTabs';
import PrescriptionCropper from './PrescriptionCropper';

interface ScanPrescriptionModalProps {
  profileId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Step = 'capture' | 'scanning' | 'review';

// Names for the provider ids the backend reports. The host and model are never exposed.
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  'openai-compatible': 'un servicio externo de inteligencia artificial'
};

function messageForCaptureError(error: unknown): string {
  return error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos conectar con el servidor.';
}

export default function ScanPrescriptionModal({ profileId, onClose, onCreated }: ScanPrescriptionModalProps) {
  const [step, setStep] = useState<Step>('capture');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<TreatmentDraft[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [submitBanner, setSubmitBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // null while loading or if it could not be fetched — then the stricter (consent) path applies.
  const [providerInfo, setProviderInfo] = useState<ScanProviderInfo | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [crop, setCrop] = useState<CropRect | null>(null);

  const consentRequired = providerInfo ? providerInfo.consentRequired : true;
  // An admin can pause scanning from the operations panel.
  const scanPaused = providerInfo?.available === false;
  const providerName = providerInfo
    ? (PROVIDER_NAMES[providerInfo.provider] ?? 'un servicio externo de inteligencia artificial')
    : 'un servicio externo de inteligencia artificial';

  useEffect(() => {
    getScanProviderInfo()
      .then(setProviderInfo)
      .catch(() => setProviderInfo(null));
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const activeDraft = drafts.find((draft) => draft.key === activeKey) ?? drafts[0] ?? null;

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCaptureError(null);
    setCrop(null);
    setImageFile(file);
    setImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  async function handleScan() {
    if (!imageFile) return;
    setStep('scanning');
    setCaptureError(null);
    try {
      // Cropped (if the user framed the medications), shrunk and stripped of EXIF on the device —
      // what leaves the phone is only this.
      const upload = await prepareImageForUpload(imageFile, crop);
      const result = await scanPrescription(upload, consentGiven);
      const nextDrafts = result.medications.length > 0 ? result.medications.map(draftFromScan) : [emptyDraft()];
      setDrafts(nextDrafts);
      setActiveKey(nextDrafts[0].key);
      setStep('review');
    } catch (error) {
      setCaptureError(messageForCaptureError(error));
      setStep('capture');
    }
  }

  function handleChange<K extends keyof TreatmentFormValues>(field: K, value: TreatmentFormValues[K]) {
    if (!activeDraft) return;
    setDrafts((current) =>
      current.map((draft) => (draft.key === activeDraft.key ? { ...draft, values: { ...draft.values, [field]: value } } : draft))
    );
  }

  function handleAddDraft() {
    const draft = emptyDraft();
    setDrafts((current) => [...current, draft]);
    setActiveKey(draft.key);
  }

  function handleRemoveDraft(key: string) {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.key !== key);
      if (activeKey === key && next.length > 0) setActiveKey(next[0].key);
      return next;
    });
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitBanner(null);
    setSaving(true);
    const { succeededCount, failedDrafts, total } = await submitDrafts(profileId, drafts, true);
    setSaving(false);

    if (succeededCount > 0) onCreated();

    if (failedDrafts.length === 0) {
      onClose();
      return;
    }

    setDrafts(failedDrafts);
    setActiveKey(failedDrafts[0].key);
    setSubmitBanner(
      succeededCount > 0
        ? `Se creó${succeededCount === 1 ? '' : 'n'} ${succeededCount} de ${total} tratamiento${succeededCount === 1 ? '' : 's'}. Revisa el${failedDrafts.length === 1 ? '' : 'os'} que falló${failedDrafts.length === 1 ? '' : 'aron'} abajo.`
        : null
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Escanear fórmula médica</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        {captureError && (
          <div role="alert" className="mt-4 rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong">
            {captureError}
          </div>
        )}

        {step !== 'review' ? (
          <div className="mt-4 flex flex-col items-center gap-4">
            {imagePreviewUrl ? (
              step === 'capture' ? (
                <div className="flex w-full flex-col gap-2">
                  <PrescriptionCropper src={imagePreviewUrl} value={crop} onChange={setCrop} />
                  <p className="text-xs text-text-caption">
                    <strong className="font-semibold text-text-secondary">Recomendado:</strong> arrastra sobre la foto
                    para encerrar solo las líneas de los medicamentos. Así tu nombre, documento y los datos del médico
                    no salen de tu teléfono.
                    {crop && (
                      <button
                        type="button"
                        onClick={() => setCrop(null)}
                        className="ml-2 font-semibold text-text-secondary underline underline-offset-2"
                      >
                        Quitar recorte
                      </button>
                    )}
                  </p>
                </div>
              ) : (
                <img
                  src={imagePreviewUrl}
                  alt="Foto de la fórmula"
                  className="max-h-80 w-full rounded-xl border border-border object-contain"
                />
              )
            ) : (
              <label
                htmlFor="prescriptionImage"
                className="flex h-48 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-muted text-center text-text-secondary"
              >
                <Camera className="h-8 w-8 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-semibold">Toma una foto o elige una imagen</span>
                <span className="px-6 text-xs text-text-caption">
                  Para leerla, la foto se envía a {providerName}. MediTrack no la guarda y nada se registra hasta
                  que revises cada medicamento. Si la fórmula tiene varios, los detectamos todos.
                </span>
              </label>
            )}
            <input
              id="prescriptionImage"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
              className="hidden"
            />

            {scanPaused && (
              <div role="alert" className="w-full rounded-lg bg-warning-bg px-3 py-2.5 text-sm font-medium text-warning">
                La lectura de fórmulas está en pausa por ahora. Puedes ingresar el medicamento manualmente.
              </div>
            )}

            {imagePreviewUrl && step === 'capture' && (
              <div
                className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                  consentRequired ? 'bg-warning-bg text-warning' : 'bg-surface-info text-text-secondary'
                }`}
              >
                {consentRequired ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                ) : (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                )}
                {consentRequired ? (
                  <label htmlFor="scanConsent" className="flex cursor-pointer flex-col gap-2">
                    <span>
                      Esta foto se enviará a <strong>{providerName}</strong>, un servicio cuyas condiciones de
                      privacidad <strong>no están verificadas</strong>: podría conservar la imagen o usarla para
                      mejorar sus productos. Envíala solo si no muestra datos personales (recórtala) o si aceptas ese
                      riesgo.
                    </span>
                    <span className="flex items-start gap-2 font-semibold">
                      <input
                        id="scanConsent"
                        type="checkbox"
                        checked={consentGiven}
                        onChange={(event) => setConsentGiven(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-primary"
                      />
                      Entiendo y acepto que la foto se envíe a este servicio.
                    </span>
                  </label>
                ) : (
                  <span>
                    La foto se envía a <strong>{providerName}</strong> solo para leerla. MediTrack no la guarda.
                  </span>
                )}
              </div>
            )}

            {imagePreviewUrl && step === 'capture' && (
              <div className="flex w-full gap-2">
                <label
                  htmlFor="prescriptionImage"
                  className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border text-sm font-semibold text-text-secondary hover:bg-surface-muted"
                >
                  Cambiar foto
                </label>
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={scanPaused || (consentRequired && !consentGiven)}
                  className="flex h-12 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Leer fórmula
                </button>
              </div>
            )}

            {step === 'scanning' && (
              <div className="flex flex-col items-center gap-2 text-sm text-text-secondary">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p>Leyendo la fórmula… puede tardar desde unos segundos hasta un minuto si tiene varios medicamentos.</p>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-text-secondary underline underline-offset-2"
            >
              Prefiero ingresarlo manualmente
            </button>
          </div>
        ) : (
          activeDraft && (
            <form onSubmit={handleConfirm} className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-5">
              <div className="flex flex-col gap-3 md:col-span-2">
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Foto de la fórmula"
                    className="max-h-96 w-full rounded-xl border border-border object-contain"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setStep('capture')}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-semibold text-text-secondary hover:bg-surface-muted"
                >
                  <Camera className="h-4 w-4" strokeWidth={1.75} />
                  Tomar otra foto
                </button>
              </div>

              <div className="flex flex-col gap-4 md:col-span-3">
                <div className="flex items-start gap-2 rounded-lg bg-surface-info px-3 py-2.5 text-sm text-text-secondary">
                  <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                  <span>
                    Detectamos {drafts.length} medicamento{drafts.length === 1 ? '' : 's'}. Revisa cada uno contra la
                    foto antes de confirmar — todo es editable, y puedes agregar otro si falta alguno.
                  </span>
                </div>

                {submitBanner && (
                  <div role="alert" className="rounded-lg bg-warning-bg px-3 py-2.5 text-sm text-warning">
                    {submitBanner}
                  </div>
                )}

                <TreatmentDraftTabs
                  drafts={drafts}
                  activeKey={activeDraft.key}
                  onSelect={setActiveKey}
                  onAdd={handleAddDraft}
                  onRemove={handleRemoveDraft}
                />

                {activeDraft.error && (
                  <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
                    {activeDraft.error}
                  </div>
                )}
                {isDraftIncomplete(activeDraft.values) && !activeDraft.error && (
                  <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2.5 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span>No logramos leer todos los datos de este medicamento — complétalo antes de confirmar.</span>
                  </div>
                )}

                <TreatmentFormFields values={activeDraft.values} onChange={handleChange} />

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-1 flex h-12 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? 'Guardando…'
                    : `Confirmar y crear ${drafts.length} tratamiento${drafts.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  );
}
