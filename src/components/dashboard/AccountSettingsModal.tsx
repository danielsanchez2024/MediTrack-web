import { useEffect, useState, type FormEvent } from 'react';
import { X, UserCog, KeyRound, Users, ShieldAlert, Trash2, MonitorSmartphone } from 'lucide-react';
import {
  updateProfile,
  changePassword,
  getCaregiverMonitoringStatus,
  setCaregiverMonitoringConsent,
  deleteOwnAccount,
  logoutAllDevices,
  ApiError,
  type CaregiverMonitoringStatus
} from '../../lib/api';
import { saveSession, clearSession, type Session } from '../../lib/session';
import { toSpanishMessage, toSpanishMessages } from '../../lib/errorMessages';
import NotificationPreferencesSection from './NotificationPreferencesSection';

interface AccountSettingsModalProps {
  session: Session;
  email: string | null;
  hasDependents: boolean;
  onClose: () => void;
  onProfileUpdated: (name: string) => void;
}

export default function AccountSettingsModal({ session, email: currentEmail, hasDependents, onClose, onProfileUpdated }: AccountSettingsModalProps) {
  const [name, setName] = useState(session.name);
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [consentStatus, setConsentStatus] = useState<CaregiverMonitoringStatus | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [loggingOutEverywhere, setLoggingOutEverywhere] = useState(false);
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null);

  useEffect(() => {
    getCaregiverMonitoringStatus()
      .then(setConsentStatus)
      .catch(() => {
        // No caregiver ever, or the lookup failed — either way there's nothing actionable to
        // show, so this section just stays hidden rather than showing an error banner.
      });
  }, []);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ name, email: email || undefined });
      onProfileUpdated(updated.name);
      setEmail('');
      setProfileSaved(true);
    } catch (error) {
      setProfileError(
        error instanceof ApiError
          ? error.details.length > 0
            ? toSpanishMessages(error.details)
            : toSpanishMessage(error.message)
          : 'No pudimos guardar los cambios.'
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    setSavingPassword(true);
    try {
      const result = await changePassword({ currentPassword, newPassword, confirmNewPassword });
      saveSession(result);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordSaved(true);
    } catch (error) {
      setPasswordError(
        error instanceof ApiError
          ? error.details.length > 0
            ? toSpanishMessages(error.details)
            : toSpanishMessage(error.message)
          : 'No pudimos cambiar la contraseña.'
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleToggleConsent() {
    if (!consentStatus) return;
    setConsentError(null);
    setConsentLoading(true);
    try {
      const nextGranted = !consentStatus.granted;
      await setCaregiverMonitoringConsent(nextGranted);
      setConsentStatus({ ...consentStatus, granted: nextGranted });
    } catch (error) {
      setConsentError(error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos actualizar el acceso.');
    } finally {
      setConsentLoading(false);
    }
  }

  async function handleLogoutEverywhere() {
    setLogoutAllError(null);
    setLoggingOutEverywhere(true);
    try {
      await logoutAllDevices();
      window.location.href = '/login';
    } catch (error) {
      setLogoutAllError(error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos cerrar las sesiones.');
      setLoggingOutEverywhere(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteOwnAccount();
      clearSession();
      window.location.href = '/login';
    } catch (error) {
      setDeleteError(error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos eliminar tu cuenta.');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Mi cuenta</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-5 flex flex-col gap-3 rounded-xl border border-border p-4">
          <p className="text-sm font-bold text-text">Nombre y correo</p>
          {profileError && (
            <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
              {profileError}
            </div>
          )}
          {profileSaved && (
            <div className="rounded-lg bg-success-bg px-3 py-2 text-xs font-medium text-secondary">Guardado.</div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text">Nombre</label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text">Correo nuevo (opcional)</label>
            <input
              type="email"
              placeholder="Déjalo en blanco para no cambiarlo"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="h-10 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingProfile ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        <NotificationPreferencesSection email={currentEmail} hasDependents={hasDependents} />

        <form onSubmit={handleChangePassword} className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <KeyRound className="h-4 w-4 text-primary" strokeWidth={1.75} />
            Cambiar contraseña
          </p>
          {passwordError && (
            <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
              {passwordError}
            </div>
          )}
          {passwordSaved && (
            <div className="rounded-lg bg-success-bg px-3 py-2 text-xs font-medium text-secondary">
              Contraseña actualizada. Tus demás sesiones se cerraron.
            </div>
          )}
          <input
            type="password"
            required
            placeholder="Contraseña actual"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="password"
            required
            placeholder="Contraseña nueva"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="password"
            required
            placeholder="Confirmar contraseña nueva"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={savingPassword}
            className="h-10 rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingPassword ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>

        {consentStatus?.hasCaregiver && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-text">
              <Users className="h-4 w-4 text-primary" strokeWidth={1.75} />
              Acceso de tu cuidador
            </p>
            <p className="-mt-2 text-xs text-text-caption">
              <a href="/caregiver-consent" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                Qué implica otorgar este acceso
              </a>
            </p>
            {consentError && (
              <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
                {consentError}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-text">{consentStatus.caregiverName}</p>
                <p className="text-xs text-text-caption">
                  {consentStatus.granted ? 'Puede ver y gestionar tus datos.' : 'No tiene acceso a tus datos.'}
                </p>
              </div>
              <button
                type="button"
                disabled={consentLoading}
                onClick={handleToggleConsent}
                className={`h-9 shrink-0 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                  consentStatus.granted
                    ? 'border border-danger-bg-soft text-danger-strong hover:bg-danger-bg'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                {consentLoading ? '...' : consentStatus.granted ? 'Revocar acceso' : 'Otorgar acceso'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <MonitorSmartphone className="h-4 w-4 text-primary" strokeWidth={1.75} />
            Sesiones abiertas
          </p>
          <p className="text-xs text-text-caption">
            Si perdiste el teléfono o entraste desde un equipo que no es tuyo, cierra la sesión en
            todos los dispositivos, incluido este.
          </p>
          {logoutAllError && (
            <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
              {logoutAllError}
            </div>
          )}
          <button
            type="button"
            disabled={loggingOutEverywhere}
            onClick={handleLogoutEverywhere}
            className="h-10 rounded-lg border border-border text-sm font-semibold text-text-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOutEverywhere ? 'Cerrando sesiones…' : 'Cerrar sesión en todos los dispositivos'}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-danger-bg-soft p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-danger-strong">
            <ShieldAlert className="h-4 w-4" strokeWidth={1.75} />
            Eliminar cuenta
          </p>
          <p className="text-xs text-text-caption">
            Dejarás de poder acceder a MediTrack con esta cuenta. Tu historial médico no se
            borra, pero nadie —incluido tú— podrá volver a verlo desde aquí.
          </p>
          {deleteError && (
            <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
              {deleteError}
            </div>
          )}
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-danger-bg-soft text-sm font-semibold text-danger-strong hover:bg-danger-bg"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              Eliminar mi cuenta
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="h-10 flex-1 rounded-lg border border-border text-sm font-semibold text-text-secondary hover:bg-surface-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteAccount}
                className="h-10 flex-1 rounded-lg bg-danger-strong text-sm font-semibold text-white hover:bg-danger disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? 'Eliminando…' : 'Sí, eliminar definitivamente'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
