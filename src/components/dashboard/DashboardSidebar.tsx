import { useState, type FormEvent } from 'react';
import { Phone, ShieldAlert, Camera, RefreshCw, Plus, X, Users, Pencil } from 'lucide-react';
import { ApiError, type Allergy, type AllergySeverity, type EmergencyCard } from '../../lib/api';
import { toSpanishMessage } from '../../lib/errorMessages';
import { isValidPhone } from '../../lib/phone';

const SEVERITY_STYLES: Record<Allergy['severity'], { bg: string; text: string; label: string }> = {
  SEVERE: { bg: 'bg-danger-bg', text: 'text-danger-strong', label: 'Severa' },
  MODERATE: { bg: 'bg-warning-bg', text: 'text-warning', label: 'Moderada' },
  MILD: { bg: 'bg-surface-muted', text: 'text-text-secondary', label: 'Leve' }
};

const SEVERITY_OPTIONS: { value: AllergySeverity; label: string }[] = [
  { value: 'MILD', label: 'Leve' },
  { value: 'MODERATE', label: 'Moderada' },
  { value: 'SEVERE', label: 'Severa' }
];

interface DashboardSidebarProps {
  emergencyCard: EmergencyCard | null;
  allergies: Allergy[];
  onScanClick: () => void;
  onManageDependentsClick: () => void;
  onAddAllergy: (description: string, severity: AllergySeverity) => Promise<void>;
  onUpdateAllergy: (allergyId: string, description: string, severity: AllergySeverity) => Promise<void>;
  onDeleteAllergy: (allergyId: string) => Promise<void>;
  // null for both removes the contact. Throws on failure.
  onSaveEmergencyContact: (name: string | null, phone: string | null) => Promise<void>;
}

export default function DashboardSidebar({
  emergencyCard,
  allergies,
  onScanClick,
  onManageDependentsClick,
  onAddAllergy,
  onUpdateAllergy,
  onDeleteAllergy,
  onSaveEmergencyContact
}: DashboardSidebarProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<AllergySeverity>('MODERATE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editSeverity, setEditSeverity] = useState<AllergySeverity>('MODERATE');
  const [savingEdit, setSavingEdit] = useState(false);

  const [editingContact, setEditingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [confirmingRemoveContact, setConfirmingRemoveContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  function startEditContact() {
    setContactName(emergencyCard?.emergencyContactName ?? '');
    setContactPhone(emergencyCard?.emergencyContactPhone ?? '');
    setContactError(null);
    setConfirmingRemoveContact(false);
    setEditingContact(true);
  }

  async function storeContact(name: string | null, phone: string | null) {
    setContactError(null);
    setSavingContact(true);
    try {
      await onSaveEmergencyContact(name, phone);
      setEditingContact(false);
      setConfirmingRemoveContact(false);
    } catch (err) {
      setContactError(
        err instanceof ApiError ? toSpanishMessage(err.message) : 'No pudimos guardar el contacto. Intenta de nuevo.'
      );
    } finally {
      setSavingContact(false);
    }
  }

  function handleSaveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactName.trim()) {
      setContactError('Ingresa el nombre del contacto.');
      return;
    }
    if (!isValidPhone(contactPhone)) {
      setContactError('Ingresa un teléfono válido.');
      return;
    }
    storeContact(contactName.trim(), contactPhone.trim());
  }

  function handleRemoveContact() {
    if (!confirmingRemoveContact) {
      setConfirmingRemoveContact(true);
      return;
    }
    storeContact(null, null);
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onAddAllergy(description, severity);
      setDescription('');
      setSeverity('MODERATE');
      setShowAddForm(false);
    } catch {
      setError('No pudimos guardar la alergia. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(allergy: Allergy) {
    setError(null);
    setEditingId(allergy.id);
    setEditDescription(allergy.description);
    setEditSeverity(allergy.severity);
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);
    setSavingEdit(true);
    try {
      await onUpdateAllergy(editingId, editDescription, editSeverity);
      setEditingId(null);
    } catch {
      setError('No pudimos guardar los cambios. Intenta de nuevo.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(allergyId: string) {
    setDeletingId(allergyId);
    try {
      await onDeleteAllergy(allergyId);
    } catch {
      setError('No pudimos quitar la alergia. Intenta de nuevo.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onManageDependentsClick}
        className="flex items-center justify-between rounded-2xl border border-border bg-surface-card p-5 text-left shadow-sm transition-colors hover:bg-surface-muted"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-text">
          <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
          Personas a mi cargo
        </span>
        <span className="text-xs font-semibold text-primary">Gestionar</span>
      </button>

      <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text">Contactos</h2>
          {emergencyCard && !editingContact && (
            <button
              type="button"
              onClick={startEditContact}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {emergencyCard.emergencyContactName ? (
                <Pencil className="h-3 w-3" strokeWidth={2} />
              ) : (
                <Plus className="h-3 w-3" strokeWidth={2} />
              )}
              {emergencyCard.emergencyContactName ? 'Editar' : 'Agregar'}
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {editingContact ? (
            <form
              onSubmit={handleSaveContact}
              noValidate
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3"
            >
              <p className="text-xs text-text-caption">
                Aparece en la Ficha SOS para que quien te atienda pueda llamarle.
              </p>
              {contactError && (
                <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
                  {contactError}
                </div>
              )}
              <input
                type="text"
                autoFocus
                aria-label="Nombre del contacto de emergencia"
                placeholder="Ej. María Gómez (hija)"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="tel"
                aria-label="Teléfono del contacto de emergencia"
                placeholder="Ej. 300 123 4567"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingContact(false)}
                  className="h-9 flex-1 rounded-md border border-border px-3 text-sm font-semibold text-text-secondary hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="h-9 flex-1 rounded-md bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingContact ? 'Guardando…' : 'Guardar contacto'}
                </button>
              </div>
              {emergencyCard?.emergencyContactName && (
                <button
                  type="button"
                  onClick={handleRemoveContact}
                  disabled={savingContact}
                  className="text-xs font-semibold text-danger-strong hover:underline disabled:opacity-60"
                >
                  {confirmingRemoveContact ? 'Haz clic otra vez para quitarlo' : 'Quitar contacto'}
                </button>
              )}
            </form>
          ) : emergencyCard?.emergencyContactName ? (
            <a
              href={emergencyCard.emergencyContactPhone ? `tel:${emergencyCard.emergencyContactPhone}` : undefined}
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-surface-muted"
            >
              <span>
                <span className="block font-semibold text-text">{emergencyCard.emergencyContactName}</span>
                <span className="text-text-caption">
                  Contacto de emergencia
                  {emergencyCard.emergencyContactPhone ? ` · ${emergencyCard.emergencyContactPhone}` : ''}
                </span>
              </span>
              <Phone className="h-4 w-4 text-secondary" strokeWidth={1.75} />
            </a>
          ) : (
            <p className="text-sm text-text-caption">No hay un contacto de emergencia registrado.</p>
          )}

          <a
            href="tel:123"
            className="flex items-center justify-between rounded-lg border border-danger-bg-soft bg-danger-bg p-3 text-sm"
          >
            <span className="font-semibold text-danger-strong">Línea Nacional de Urgencias</span>
            <Phone className="h-4 w-4 text-danger-strong" strokeWidth={1.75} />
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-danger-strong" strokeWidth={1.75} />
            <h2 className="text-sm font-bold text-text">Alergias clínicas</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((current) => !current)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-muted"
            aria-label={showAddForm ? 'Cancelar' : 'Agregar alergia'}
          >
            {showAddForm ? <X className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-2 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
            {error}
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
            <input
              type="text"
              required
              autoFocus
              placeholder="Ej. Penicilina"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-2">
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value as AllergySeverity)}
                className="h-9 flex-1 rounded-md border border-border bg-white px-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={saving}
                className="h-9 shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {allergies.length === 0 && <p className="text-sm text-text-caption">Sin alergias registradas.</p>}
          {allergies.map((allergy) => {
            const style = SEVERITY_STYLES[allergy.severity];

            if (editingId === allergy.id) {
              return (
                <form
                  key={allergy.id}
                  onSubmit={handleSaveEdit}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3"
                >
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-white px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex gap-2">
                    <select
                      value={editSeverity}
                      onChange={(event) => setEditSeverity(event.target.value as AllergySeverity)}
                      className="h-9 flex-1 rounded-md border border-border bg-white px-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {SEVERITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="h-9 shrink-0 rounded-md border border-border px-3 text-sm font-semibold text-text-secondary hover:bg-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="h-9 shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingEdit ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={allergy.id}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${style.bg}`}
              >
                <span className="font-medium text-text">{allergy.description}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(allergy)}
                    className="text-text-muted hover:text-primary"
                    aria-label={`Editar alergia a ${allergy.description}`}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === allergy.id}
                    onClick={() => handleDelete(allergy.id)}
                    className="text-text-muted hover:text-danger-strong disabled:opacity-50"
                    aria-label={`Quitar alergia a ${allergy.description}`}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-primary p-5 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5" strokeWidth={1.75} />
          <h2 className="text-sm font-bold">¿Nueva fórmula médica?</h2>
        </div>
        <p className="mt-2 text-sm text-white/85">
          Escanea la receta y un servicio externo de inteligencia artificial leerá el
          medicamento, la dosis y la frecuencia para que solo tengas que revisarlos.
        </p>
        <button
          type="button"
          onClick={onScanClick}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white/15 text-sm font-semibold text-white transition-colors hover:bg-white/25"
        >
          📷 Escanear nueva receta
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-surface-info px-4 py-3 text-xs text-text-secondary">
        <RefreshCw className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
        Las confirmaciones se guardan de inmediato; los demás cuidadores las verán al abrir o
        actualizar su panel.
      </div>
    </div>
  );
}
