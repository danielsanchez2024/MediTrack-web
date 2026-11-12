import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  LogOut,
  ShieldCheck,
  Users,
  FileText,
  UserCheck,
  UserX,
  ShieldPlus,
  ShieldMinus,
  Plus,
  Activity,
  Gauge,
  BarChart3,
  Workflow,
  Bot,
  Server,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { getSession } from '../lib/session';
import {
  getProfile,
  getAdminUsers,
  setAdminUserActive,
  setAdminUserRole,
  getPrivacyPolicies,
  createPrivacyPolicy,
  getPlatformUsage,
  logout,
  ApiError,
  type AdminUserSummary,
  type PrivacyPolicy,
  type ConsentType,
  type PlatformUsageSummary,
  type OpsRange
} from '../lib/api';
import OverviewTab from './admin/OverviewTab';
import TrafficTab from './admin/TrafficTab';
import FlowsTab from './admin/FlowsTab';
import AiTab from './admin/AiTab';
import SystemTab from './admin/SystemTab';
import ControlTab from './admin/ControlTab';
import { RANGES } from './admin/labels';
import { toSpanishMessage, toSpanishMessages } from '../lib/errorMessages';
import { formatFullDate, formatTime } from '../lib/date';

const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  HEALTH_DATA_PROCESSING: 'Tratamiento de datos de salud',
  CAREGIVER_MONITORING: 'Monitoreo por cuidadores'
};

type AccessState = 'checking' | 'denied' | 'granted';

type AdminTab = 'resumen' | 'trafico' | 'flujos' | 'ia' | 'sistema' | 'control' | 'usuarios' | 'politicas';

const TABS: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: 'resumen', label: 'Resumen', icon: Gauge },
  { id: 'trafico', label: 'Tráfico', icon: BarChart3 },
  { id: 'flujos', label: 'Flujos', icon: Workflow },
  { id: 'ia', label: 'IA y límites', icon: Bot },
  { id: 'sistema', label: 'Sistema', icon: Server },
  { id: 'control', label: 'Control y auditoría', icon: SlidersHorizontal },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'politicas', label: 'Políticas', icon: FileText }
];

// Tabs that show live operations data (and so get the refresh controls), and the ones with a period.
const OPS_TABS = new Set<AdminTab>(['resumen', 'trafico', 'flujos', 'ia', 'sistema', 'control']);
const RANGE_TABS = new Set<AdminTab>(['trafico', 'flujos', 'sistema']);

export default function AdminDashboard() {
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [selfId, setSelfId] = useState<string | null>(null);

  const [tab, setTab] = useState<AdminTab>('resumen');
  const [range, setRange] = useState<OpsRange>('1h');
  const [live, setLive] = useState(true);
  const [tick, setTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const [usage, setUsage] = useState<PlatformUsageSummary | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<{ id: string; message: string } | null>(null);

  const [policies, setPolicies] = useState<PrivacyPolicy[] | null>(null);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [newPolicyType, setNewPolicyType] = useState<ConsentType>('HEALTH_DATA_PROCESSING');
  const [newPolicyVersion, setNewPolicyVersion] = useState('');
  const [newPolicyUrl, setNewPolicyUrl] = useState('');
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [createPolicyError, setCreatePolicyError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      window.location.href = '/login';
      return;
    }
    setSelfId(session.userId);

    getProfile(session.userId)
      .then((me) => {
        setAccessState(me.role === 'ADMIN' ? 'granted' : 'denied');
      })
      .catch(() => setAccessState('denied'));
  }, []);

  const loadUsage = useCallback(async () => {
    setUsageError(null);
    try {
      setUsage(await getPlatformUsage());
    } catch (error) {
      setUsageError(error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos cargar las métricas de uso.');
    }
  }, []);

  // page 0 replaces the list (first load or a new search); later pages append to it.
  const loadUsers = useCallback(async (query = '', page = 0) => {
    setUsersError(null);
    if (page > 0) setUsersLoadingMore(true);
    try {
      const result = await getAdminUsers(query, page);
      setUsers((current) => (page === 0 || !current ? result.items : [...current, ...result.items]));
      setUsersTotal(result.total);
      setUsersPage(result.page);
    } catch (error) {
      setUsersError(error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos cargar los usuarios.');
    } finally {
      setUsersLoadingMore(false);
    }
  }, []);

  const loadPolicies = useCallback(async () => {
    setPoliciesError(null);
    try {
      setPolicies(await getPrivacyPolicies());
    } catch (error) {
      setPoliciesError(
        error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos cargar las políticas de privacidad.'
      );
    }
  }, []);

  useEffect(() => {
    if (accessState !== 'granted') return;
    loadUsage();
    loadUsers();
    loadPolicies();
  }, [accessState, loadUsage, loadUsers, loadPolicies]);

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }

  async function handleToggleActive(user: AdminUserSummary) {
    setUserActionError(null);
    setUserActionId(user.id);
    try {
      const updated = await setAdminUserActive(user.id, !user.active);
      setUsers((current) => current?.map((u) => (u.id === updated.id ? updated : u)) ?? null);
    } catch (error) {
      setUserActionError({
        id: user.id,
        message: error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos actualizar el estado.'
      });
    } finally {
      setUserActionId(null);
    }
  }

  async function handleToggleRole(user: AdminUserSummary) {
    setUserActionError(null);
    setUserActionId(user.id);
    try {
      const updated = await setAdminUserRole(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN');
      setUsers((current) => current?.map((u) => (u.id === updated.id ? updated : u)) ?? null);
    } catch (error) {
      setUserActionError({
        id: user.id,
        message: error instanceof ApiError ? toSpanishMessage(error.message) : 'No pudimos actualizar el rol.'
      });
    } finally {
      setUserActionId(null);
    }
  }

  async function handleCreatePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatePolicyError(null);
    setCreatingPolicy(true);
    try {
      await createPrivacyPolicy({
        policyType: newPolicyType,
        version: newPolicyVersion,
        contentUrl: newPolicyUrl || undefined
      });
      setNewPolicyVersion('');
      setNewPolicyUrl('');
      await loadPolicies();
    } catch (error) {
      setCreatePolicyError(
        error instanceof ApiError
          ? error.details.length > 0
            ? toSpanishMessages(error.details)
            : toSpanishMessage(error.message)
          : 'No pudimos publicar la nueva versión.'
      );
    } finally {
      setCreatingPolicy(false);
    }
  }

  const sortedUsers = useMemo(() => {
    if (!users) return null;
    // By instant: the API sends offsets, so string order isn't guaranteed to be time order.
    return [...users].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [users]);

  if (accessState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-text-caption">Verificando acceso…</p>
      </div>
    );
  }

  if (accessState === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
        <ShieldCheck className="h-10 w-10 text-text-muted" strokeWidth={1.5} />
        <p className="text-base font-semibold text-text">No tienes acceso a esta sección</p>
        <p className="max-w-sm text-sm text-text-caption">
          Esta área es solo para administradores de la plataforma.
        </p>
        <a
          href="/dashboard"
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Volver al inicio
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-16">
      <header className="border-b border-border bg-surface-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
            <span className="text-lg font-bold text-primary">Administración</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              Volver al panel
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-surface-card">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div role="tablist" aria-label="Secciones de administración" className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <button
                key={item.id}
                role="tab"
                id={`admin-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls="admin-panel"
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                  tab === item.id ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-primary'
                }`}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {OPS_TABS.has(tab) && (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6 lg:px-8">
          {RANGE_TABS.has(tab) ? (
            <div role="radiogroup" aria-label="Periodo" className="flex flex-wrap gap-1.5">
              {RANGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={range === option.id}
                  onClick={() => setRange(option.id)}
                  className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    range === option.id ? 'bg-primary text-white' : 'border border-border bg-surface-card text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-xs text-text-caption">
            <span aria-live="off">{updatedAt ? `Actualizado ${new Date(updatedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}` : 'Cargando…'}</span>
            <button
              type="button"
              onClick={() => setTick((value) => value + 1)}
              className="flex items-center gap-1 font-semibold text-text-secondary hover:text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Actualizar
            </button>
            <button
              type="button"
              aria-pressed={live}
              onClick={() => setLive((value) => !value)}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 font-semibold ${
                live ? 'border-primary/30 bg-surface-info text-primary' : 'border-border text-text-secondary'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${live ? 'bg-secondary' : 'bg-text-muted'}`} aria-hidden="true" />
              {live ? 'En vivo' : 'En pausa'}
            </button>
          </div>
        </div>
      )}

      <main id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        {tab === 'resumen' && (
          <OverviewTab live={live} tick={tick} onUpdated={setUpdatedAt} onNavigate={setTab} />
        )}
        {tab === 'trafico' && <TrafficTab range={range} live={live} tick={tick} onUpdated={setUpdatedAt} />}
        {tab === 'flujos' && <FlowsTab range={range} live={live} tick={tick} onUpdated={setUpdatedAt} />}
        {tab === 'ia' && <AiTab live={live} tick={tick} onUpdated={setUpdatedAt} onNavigate={setTab} />}
        {tab === 'sistema' && <SystemTab range={range} live={live} tick={tick} onUpdated={setUpdatedAt} />}
        {tab === 'control' && <ControlTab live={live} tick={tick} onUpdated={setUpdatedAt} />}
        {tab === 'usuarios' && (
          <>
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Uso de la plataforma</h2>
          </div>

          {usageError && (
            <div role="alert" className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
              {usageError}
            </div>
          )}

          {!usage && !usageError && <p className="text-sm text-text-caption">Cargando métricas…</p>}

          {usage && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border p-4">
                <p className="text-2xl font-bold text-text">{usage.totalUsers}</p>
                <p className="text-xs text-text-caption">Usuarios totales</p>
                <p className="mt-1 text-xs text-text-caption">
                  {usage.activeUsers} activas · {usage.inactiveUsers} desactivadas · {usage.adminUsers} admin
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-2xl font-bold text-primary">{usage.usersActiveLast7Days}</p>
                <p className="text-xs text-text-caption">Usuarios activos (7 días)</p>
                <p className="mt-1 text-xs text-text-caption">{usage.usersActiveLast30Days} en 30 días</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-2xl font-bold text-secondary">{usage.newUsersLast7Days}</p>
                <p className="text-xs text-text-caption">Registros nuevos (7 días)</p>
                <p className="mt-1 text-xs text-text-caption">{usage.newUsersLast30Days} en 30 días</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-2xl font-bold text-text">{usage.activeTreatments}</p>
                <p className="text-xs text-text-caption">Tratamientos activos</p>
                <p className="mt-1 text-xs text-text-caption">
                  {usage.dosesRecordedLast7Days} dosis registradas (7 días)
                </p>
              </div>
            </div>
          )}
        </section>


        <section>
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Usuarios</h2>
          </div>
          <p className="mb-4 text-sm text-text-caption">
            Solo se muestra información básica de la cuenta. Ningún dato médico (tratamientos, dosis, alergias o la
            tarjeta de emergencia) es visible desde aquí.
          </p>

          {usersError && (
            <div role="alert" className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
              {usersError}
            </div>
          )}

          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setUserQuery(userSearch.trim());
              loadUsers(userSearch.trim(), 0);
            }}
            className="mb-4 flex gap-2"
          >
            <input
              type="search"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              maxLength={100}
              placeholder="Buscar por nombre o correo"
              aria-label="Buscar usuarios por nombre o correo"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-text"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              Buscar
            </button>
          </form>

          {!sortedUsers && !usersError && <p className="text-sm text-text-caption">Cargando usuarios…</p>}
          {sortedUsers && sortedUsers.length === 0 && (
            <p className="text-sm text-text-caption">
              {userQuery ? `Ningún usuario coincide con «${userQuery}».` : 'Todavía no hay usuarios.'}
            </p>
          )}

          {sortedUsers && (
            <div className="flex flex-col gap-3">
              {sortedUsers.map((user) => {
                const isSelf = user.id === selfId;
                const isLoading = userActionId === user.id;
                const error = userActionError?.id === user.id ? userActionError.message : null;

                return (
                  <div key={user.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-text">
                          {user.name} {isSelf && <span className="text-xs font-normal text-text-caption">(tú)</span>}
                        </p>
                        <p className="text-xs text-text-caption">{user.email}</p>
                        <p className="text-xs text-text-caption">
                          {user.lastLoginAt
                            ? `Último acceso: ${formatFullDate(user.lastLoginAt)}, ${formatTime(user.lastLoginAt)}`
                            : 'Nunca ha iniciado sesión'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-surface-muted text-text-secondary'
                          }`}
                        >
                          {user.role === 'ADMIN' ? 'Administrador' : 'Usuario'}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.active ? 'bg-success-bg text-secondary' : 'bg-danger-bg text-danger-strong'
                          }`}
                        >
                          {user.active ? 'Activa' : 'Desactivada'}
                        </span>
                      </div>
                    </div>

                    {error && (
                      <div role="alert" className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-strong">
                        {error}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isLoading || (isSelf && user.active)}
                        onClick={() => handleToggleActive(user)}
                        title={isSelf && user.active ? 'No puedes desactivar tu propia cuenta' : undefined}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {user.active ? (
                          <>
                            <UserX className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Reactivar
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isLoading || (isSelf && user.role === 'ADMIN')}
                        onClick={() => handleToggleRole(user)}
                        title={isSelf && user.role === 'ADMIN' ? 'No puedes quitarte tu propio rol de administrador' : undefined}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-primary px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {user.role === 'ADMIN' ? (
                          <>
                            <ShieldMinus className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Quitar rol de admin
                          </>
                        ) : (
                          <>
                            <ShieldPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Hacer administrador
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-col items-center gap-2 pt-1">
                <p className="text-xs text-text-caption" aria-live="polite">
                  Mostrando {sortedUsers.length} de {usersTotal}
                </p>
                {sortedUsers.length < usersTotal && (
                  <button
                    type="button"
                    disabled={usersLoadingMore}
                    onClick={() => loadUsers(userQuery, usersPage + 1)}
                    className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-muted disabled:opacity-60"
                  >
                    {usersLoadingMore ? 'Cargando…' : 'Cargar más'}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

          </>
        )}
        {tab === 'politicas' && (
          <>
        <section>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-bold text-text">Políticas de privacidad</h2>
          </div>

          <form onSubmit={handleCreatePolicy} className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-text">
              <Plus className="h-4 w-4 text-primary" strokeWidth={1.75} />
              Publicar nueva versión
            </p>
            {createPolicyError && (
              <div role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
                {createPolicyError}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="policyType" className="text-sm font-semibold text-text">
                Tipo de política
              </label>
              <select
                id="policyType"
                value={newPolicyType}
                onChange={(event) => setNewPolicyType(event.target.value as ConsentType)}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {Object.entries(CONSENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="policyVersion" className="text-sm font-semibold text-text">
                Versión
              </label>
              <input
                id="policyVersion"
                type="text"
                required
                placeholder="Ej. v1.1"
                value={newPolicyVersion}
                onChange={(event) => setNewPolicyVersion(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="policyUrl" className="text-sm font-semibold text-text">
                Enlace al contenido (opcional)
              </label>
              <input
                id="policyUrl"
                type="url"
                placeholder="https://..."
                value={newPolicyUrl}
                onChange={(event) => setNewPolicyUrl(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-[15px] text-text outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={creatingPolicy}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingPolicy ? 'Publicando…' : 'Publicar versión'}
            </button>
          </form>

          {policiesError && (
            <div role="alert" className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm font-medium text-danger-strong">
              {policiesError}
            </div>
          )}

          {!policies && !policiesError && <p className="text-sm text-text-caption">Cargando políticas…</p>}

          {policies && (
            <div className="flex flex-col gap-3">
              {policies.length === 0 && <p className="text-sm text-text-caption">Todavía no hay políticas publicadas.</p>}
              {policies.map((policy) => (
                <div key={policy.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text">
                        {CONSENT_TYPE_LABELS[policy.policyType] ?? policy.policyType} — {policy.version}
                      </p>
                      <p className="text-xs text-text-caption">
                        Publicada el {formatFullDate(policy.publishedAt)} a las {formatTime(policy.publishedAt)}
                      </p>
                      {policy.contentUrl && (
                        <a
                          href={policy.contentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Ver contenido
                        </a>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        policy.active ? 'bg-success-bg text-secondary' : 'bg-surface-muted text-text-secondary'
                      }`}
                    >
                      {policy.active ? 'Vigente' : 'Reemplazada'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
          </>
        )}
      </main>
    </div>
  );
}
