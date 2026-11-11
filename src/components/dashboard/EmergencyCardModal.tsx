import { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Phone, Pill, Download, AlertTriangle } from 'lucide-react';
import { getEmergencyCardPdf, ApiError, type EmergencyCard, type AllergySeverity } from '../../lib/api';
import { toSpanishMessage } from '../../lib/errorMessages';
import { formatFrequency } from '../../lib/date';

interface EmergencyCardModalProps {
  card: EmergencyCard;
  profileId: string;
  onClose: () => void;
}

const SEVERITY_STYLES: Record<AllergySeverity, { bg: string; border: string; text: string; label: string }> = {
  SEVERE: { bg: 'bg-danger-strong', border: 'border-danger-strong', text: 'text-white', label: 'Severa' },
  MODERATE: { bg: 'bg-warning-bg', border: 'border-warning-bg-soft', text: 'text-warning', label: 'Moderada' },
  MILD: { bg: 'bg-surface-muted', border: 'border-border', text: 'text-text-secondary', label: 'Leve' }
};

export default function EmergencyCardModal({ card, profileId, onClose }: EmergencyCardModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // A plain fetch is already non-blocking — the modal (and the rest of the app) stays fully
  // interactive while this runs. The "Descargando…" label is just feedback that something is
  // happening, not a sign the UI is frozen waiting on it.
  async function handleDownload() {
    setDownloadError(null);
    setDownloading(true);
    try {
      const blob = await getEmergencyCardPdf(profileId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ficha-emergencia-${card.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos generar el PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface-card shadow-md">
        <div className="bg-danger-strong px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.75} />
              <h2 className="text-sm font-bold uppercase tracking-wide">Ficha de emergencia</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="text-white/80 hover:text-white">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
          <p className="mt-2 text-2xl font-bold">{card.name}</p>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-6">
          {card.emergencyContactName && (
            <a
              href={card.emergencyContactPhone ? `tel:${card.emergencyContactPhone}` : undefined}
              className="flex items-center justify-between rounded-xl border border-border p-3.5 hover:bg-surface-muted"
            >
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-text-caption">
                  Contacto de emergencia
                </span>
                <span className="text-sm font-semibold text-text">
                  {card.emergencyContactName}
                  {card.emergencyContactPhone ? ` · ${card.emergencyContactPhone}` : ''}
                </span>
              </span>
              <Phone className="h-5 w-5 shrink-0 text-secondary" strokeWidth={1.75} />
            </a>
          )}

          <div className={`rounded-xl border p-4 ${card.allergies.length > 0 ? 'border-danger-bg-soft bg-danger-bg' : 'border-border'}`}>
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-danger-strong">
              <ShieldAlert className="h-4 w-4" strokeWidth={1.75} />
              Alergias
            </h3>
            {card.allergies.length === 0 ? (
              <p className="mt-1.5 text-sm text-text-caption">Sin alergias registradas.</p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {card.allergies.map((allergy) => {
                  const style = SEVERITY_STYLES[allergy.severity];
                  return (
                    <span
                      key={allergy.description}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${style.bg} ${style.border} ${style.text}`}
                    >
                      {allergy.severity === 'SEVERE' && <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />}
                      {allergy.description}
                      <span className="text-xs font-normal opacity-80">· {style.label}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-text">
              <Pill className="h-4 w-4 text-primary" strokeWidth={1.75} />
              Tratamientos activos
            </h3>
            {card.activeTreatments.length === 0 ? (
              <p className="mt-1.5 text-sm text-text-caption">Sin tratamientos activos.</p>
            ) : (
              <div className="mt-2.5 flex flex-col gap-2">
                {card.activeTreatments.map((treatment) => (
                  <div key={treatment.id} className="rounded-xl border border-border p-3.5">
                    <p className="font-semibold text-text">{treatment.medicationName}</p>
                    <p className="text-sm text-text-secondary">
                      {treatment.dosage} · {formatFrequency(treatment.frequencyValue, treatment.frequencyUnit)}
                    </p>
                    {treatment.instructions && (
                      <p className="mt-1 text-sm italic text-text-caption">{treatment.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {downloadError && (
            <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
              {downloadError}
            </div>
          )}

          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            {downloading ? 'Descargando…' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
