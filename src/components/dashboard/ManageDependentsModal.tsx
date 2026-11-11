import { useState, type FormEvent } from 'react';
import { X, Users, UserPlus, Copy, Check, Ban, KeyRound, Trash2 } from 'lucide-react';
import {
  createDependent,
  inviteDependent,
  cancelDependentInvite,
  deleteDependent,
  ApiError,
  type ProfileSummary,
  type DependentInvite
} from '../../lib/api';
import { toSpanishMessage, toSpanishMessages } from '../../lib/errorMessages';
import { formatFullDate, formatTime } from '../../lib/date';

interface ManageDependentsModalProps {
  dependents: ProfileSummary[];
  onClose: () => void;
  onChanged: () => void;
}

export default function ManageDependentsModal({ dependents, onClose, onChanged }: ManageDependentsModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionErrorId, setActionErrorId] = useState<{ id: string; message: string } | null>(null);
  // Only kept client-side, for the duration this modal is open — the backend never re-shows a
  // raw token after issuing it (it's stored hashed, same pattern as refresh tokens), so this is
  // the only chance the caregiver gets to copy/relay it.
  const [issuedInvites, setIssuedInvites] = useState<Record<string, DependentInvite>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createDependent({ name, email: email || undefined });
      setName('');
      setEmail('');
      onChanged();
    } catch (error) {
      setCreateError(
        error instanceof ApiError
          ? error.details.length > 0
            ? toSpanishMessages(error.details)
            : toSpanishMessage(error.message)
          : 'No pudimos conectar con el servidor. Intenta de nuevo.'
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(dependentId: string) {
    setActionErrorId(null);
    setActionLoadingId(dependentId);
    try {
      const invite = await inviteDependent(dependentId);
      setIssuedInvites((current) => ({ ...current, [dependentId]: invite }));
    } catch (error) {
      setActionErrorId({
        id: dependentId,
        message: error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos generar el código.'
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCancelInvite(dependentId: string) {
    setActionErrorId(null);
    setActionLoadingId(dependentId);
    try {
      await cancelDependentInvite(dependentId);
      setIssuedInvites((current) => {
        const next = { ...current };
        delete next[dependentId];
        return next;
      });
    } catch (error) {
      setActionErrorId({
        id: dependentId,
        message: error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos cancelar la invitación.'
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(dependentId: string) {
    setActionErrorId(null);
    setDeletingId(dependentId);
    try {
      await deleteDependent(dependentId);
      setConfirmingDeleteId(null);
      onChanged();
    } catch (error) {
      setActionErrorId({
        id: dependentId,
        message: error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos eliminar este perfil.'
      });
      setDeletingId(null);
    }
  }

  async function handleCopy(dependentId: string, token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedId(dependentId);
      setTimeout(() => setCopiedId((current) => (current === dependentId ? null : current)), 2000);
    } catch {
      // Clipboard API can be unavailable (non-secure context, permissions) — the code is still
      // shown selectable on screen, so this isn't a dead end, just a missed shortcut.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-surface-card p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Personas a mi cargo</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-text-muted" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <UserPlus className="h-4 w-4 text-primary" strokeWidth={1.75} />
            Agregar un nuevo perfil
          </p>
          {createError && (
            <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
              {createError}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dependentName" className="text-sm font-semibold text-text">
              Nombre
            </label>
            <input
              id="dependentName"
              type="text"
              required
              placeholder="Ej. Rosa Martínez"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dependentEmail" className="text-sm font-semibold text-text">
              Correo (opcional)
            </label>
            <input
              id="dependentEmail"
              type="email"
              placeholder="Solo si la persona algún día tendrá su propia cuenta"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Creando…' : 'Crear perfil'}
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-3">
          {dependents.length === 0 && (
            <p className="text-sm text-text-caption">Aún no tienes ningún perfil a tu cargo.</p>
          )}

          {dependents.map((dependent) => {
            const invite = issuedInvites[dependent.id];
            const isLoading = actionLoadingId === dependent.id;
            const error = actionErrorId?.id === dependent.id ? actionErrorId.message : null;

            return (
              <div key={dependent.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text">{dependent.name}</p>
                    <p className="text-xs text-text-caption">
                      {dependent.claimed ? dependent.email ?? 'Cuenta propia activa' : 'Sin cuenta propia — lo gestionas tú'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {dependent.claimed && (
                      <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-secondary">
                        Cuenta propia
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(dependent.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger-strong"
                      aria-label={`Eliminar perfil de ${dependent.name}`}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
                    {error}
                  </div>
                )}

                {confirmingDeleteId === dependent.id && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg bg-danger-bg px-3 py-2.5">
                    <p className="text-xs text-danger-strong">
                      No se borra su historial médico, pero {dependent.claimed ? 'perderá el acceso a su cuenta' : 'dejarás de poder gestionar sus tratamientos'} de inmediato. ¿Eliminar el perfil de {dependent.name}?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="h-8 flex-1 rounded-lg border border-border bg-white text-xs font-semibold text-text-secondary hover:bg-surface-muted"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === dependent.id}
                        onClick={() => handleDelete(dependent.id)}
                        className="h-8 flex-1 rounded-lg bg-danger-strong text-xs font-semibold text-white hover:bg-danger disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === dependent.id ? 'Eliminando…' : 'Sí, eliminar'}
                      </button>
                    </div>
                  </div>
                )}

                {!dependent.claimed && (
                  <>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleInvite(dependent.id)}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Generar código para reclamar cuenta
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleCancelInvite(dependent.id)}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                        title="Cancelar una invitación pendiente"
                      >
                        <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Cancelar
                      </button>
                    </div>

                    {invite && (
                      <div className="mt-3 rounded-lg bg-surface-info p-3">
                        <p className="text-xs text-text-secondary">
                          Compártele este código a {dependent.name} (en persona, WhatsApp, etc.) para que cree su
                          propio acceso. Válido hasta el {formatFullDate(invite.expiresAt)} a las{' '}
                          {formatTime(invite.expiresAt)}.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 overflow-x-auto rounded-md bg-white px-2 py-1.5 text-xs text-text">
                            {invite.claimToken}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(dependent.id, invite.claimToken)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-strong bg-white text-text-secondary hover:bg-surface-muted"
                            aria-label="Copiar código"
                          >
                            {copiedId === dependent.id ? (
                              <Check className="h-4 w-4 text-secondary" strokeWidth={1.75} />
                            ) : (
                              <Copy className="h-4 w-4" strokeWidth={1.75} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
