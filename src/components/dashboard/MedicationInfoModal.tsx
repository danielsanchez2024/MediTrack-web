import { useEffect, useState } from 'react';
import { X, Pill, ExternalLink } from 'lucide-react';
import { getMedicationDetail, ApiError, type MedicationDetail } from '../../lib/api';
import { toSpanishMessage } from '../../lib/errorMessages';

interface MedicationInfoModalProps {
  medicationId: string;
  onClose: () => void;
}

// Builds a link to MedlinePlus's own search results page for a term — verified against their
// real search form (medlineplus.gov/spanish, form#mplus-search). We never fetch, store, or
// display MedlinePlus's own text ourselves: this only ever sends the visitor to their site in a
// new tab, the same as any other outbound link, so there's nothing to license or attribute.
function medlinePlusSearchUrl(term: string): string {
  const params = new URLSearchParams({
    'v:project': 'medlineplus-spanish',
    'v:sources': 'medlineplus-spanish-bundle',
    query: term
  });
  return `https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?${params.toString()}`;
}

export default function MedicationInfoModal({ medicationId, onClose }: MedicationInfoModalProps) {
  const [detail, setDetail] = useState<MedicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMedicationDetail(medicationId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? toSpanishMessage(err.message) : 'No pudimos cargar la información del medicamento.'));
  }, [medicationId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Información del medicamento</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </div>
        )}

        {!detail && !error && <p className="mt-4 text-sm text-text-caption">Cargando…</p>}

        {detail && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-base font-bold text-text">{detail.commercialName}</p>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              {detail.activeIngredient && (
                <>
                  <dt className="font-semibold text-text-secondary">Principio activo</dt>
                  <dd className="text-text">{detail.activeIngredient}</dd>
                </>
              )}
              {detail.pharmaceuticalForm && (
                <>
                  <dt className="font-semibold text-text-secondary">Forma</dt>
                  <dd className="text-text">{detail.pharmaceuticalForm}</dd>
                </>
              )}
              {detail.administrationRoute && (
                <>
                  <dt className="font-semibold text-text-secondary">Vía</dt>
                  <dd className="text-text">{detail.administrationRoute}</dd>
                </>
              )}
              {detail.atcGroup && (
                <>
                  <dt className="font-semibold text-text-secondary">Grupo terapéutico</dt>
                  <dd className="text-text">{detail.atcGroup}</dd>
                </>
              )}
            </dl>

            {!detail.activeIngredient && !detail.pharmaceuticalForm && !detail.administrationRoute && (
              <p className="text-sm text-text-caption">
                Este medicamento se registró manualmente y no tiene datos adicionales de INVIMA.
              </p>
            )}

            {detail.activeIngredient && (
              <a
                href={medlinePlusSearchUrl(detail.activeIngredient)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-muted"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                Buscar en MedlinePlus
              </a>
            )}
            <p className="text-xs text-text-caption">
              MedlinePlus es un servicio externo de la Biblioteca Nacional de Medicina de EE. UU., no
              afiliado a MediTrack. Se abre en una pestaña nueva.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
