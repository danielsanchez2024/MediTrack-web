import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, LogOut, Plus, Bell, Clock, ListChecks, UserCog, Settings, History } from 'lucide-react';
import { getSession, saveSession, type Session } from '../lib/session';
import {
  getDependents,
  getProfile,
  getScheduledDoses,
  updateDoseStatus,
  getAdherenceSummary,
  getAllergies,
  addAllergy,
  updateAllergy,
  deleteAllergy,
  updateEmergencyContact,
  getEmergencyCard,
  getConsentStatus,
  logout,
  ApiError,
  type ProfileSummary,
  type ScheduledDose,
  type AdherenceSummary,
  type Allergy,
  type AllergySeverity,
  type EmergencyCard,
  type ConsentStatus
} from '../lib/api';
import { toISODate, formatFullDate, formatTime } from '../lib/date';
import { toSpanishMessage } from '../lib/errorMessages';
import { getNotificationSupport, requestNotificationPermission, notify, type NotificationSupport } from '../lib/notifications';
import ProfileSwitcher from './dashboard/ProfileSwitcher';
import DaySelector, { type DayOption } from './dashboard/DaySelector';
import DoseCard from './dashboard/DoseCard';
import DashboardSidebar from './dashboard/DashboardSidebar';
import EmergencyCardModal from './dashboard/EmergencyCardModal';
import AddTreatmentModal from './dashboard/AddTreatmentModal';
import ScanPrescriptionModal from './dashboard/ScanPrescriptionModal';
import ManageDependentsModal from './dashboard/ManageDependentsModal';
import ManageTreatmentsModal from './dashboard/ManageTreatmentsModal';
import AccountSettingsModal from './dashboard/AccountSettingsModal';
import DoseDetailModal from './dashboard/DoseDetailModal';
import ConsentGateModal from './dashboard/ConsentGateModal';
import AdherenceHistoryModal from './dashboard/AdherenceHistoryModal';

// How far ahead of a dose to fire the "coming up" notification/countdown — must match
// ScheduledDoseService.EARLY_RECORDING_BUFFER_MINUTES on the backend, which is what actually
// decides when a dose becomes recordable; this only decides when to warn about it.
const UPCOMING_NOTIFICATION_MINUTES = 10;
// How often the live clock ticks — fine-grained enough for a "disponible en X min" countdown
// and for catching the upcoming/due notification thresholds without excessive re-renders.
const CLOCK_TICK_MS = 15_000;
// A "es hora" notification is only worth firing for a dose that just came due — opening the
// dashboard with several overdue doses shouldn't fire a burst of stale notifications at once.
const DUE_NOTIFICATION_GRACE_MINUTES = 15;

function dateForDay(day: DayOption): Date {
  const date = new Date();
  if (day === 'yesterday') date.setDate(date.getDate() - 1);
  if (day === 'tomorrow') date.setDate(date.getDate() + 1);
  return date;
}

// The sequential-order lock this banner describes is real and enforced server-side
// (ScheduledDoseService.updateStatus rejects out-of-order recording) — it's per medication,
// not across every medication at once, so two different treatments' doses don't block
// each other.
function ProtocolBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border-l-4 border-primary bg-surface-info p-4">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
      <p className="text-sm text-text-secondary">
        Para prevenir duplicaciones, las tomas de cada medicamento se deben registrar en orden
        cronológico: la siguiente dosis de un medicamento se habilita solo cuando la anterior de
        ese mismo medicamento ya fue resuelta.
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [day, setDay] = useState<DayOption>('today');
  const [doses, setDoses] = useState<ScheduledDose[] | null>(null);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [emergencyCard, setEmergencyCard] = useState<EmergencyCard | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showAddTreatmentModal, setShowAddTreatmentModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showDependentsModal, setShowDependentsModal] = useState(false);
  const [showTreatmentsModal, setShowTreatmentsModal] = useState(false);
  const [showAdherenceHistoryModal, setShowAdherenceHistoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [detailDoseId, setDetailDoseId] = useState<string | null>(null);
  const [savingDoseId, setSavingDoseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [notificationSupport, setNotificationSupport] = useState<NotificationSupport>('unsupported');
  // Which dose+type notifications already fired this session, so the ticking clock doesn't
  // re-fire the same one every 15s for as long as its threshold stays crossed. Resets on
  // reload — acceptable since these are foreground-only anyway (see lib/notifications.ts).
  const notifiedRef = useRef<Set<string>>(new Set());
  // Bumped on every loadDayData call: a response that arrives after a newer request started
  // (a slow poll, a quick profile switch) is discarded instead of overwriting what's on screen
  // with another person's data.
  const loadRequestRef = useRef(0);

  useEffect(() => {
    setNotificationSupport(getNotificationSupport());
    const clock = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(clock);
  }, []);

  async function handleEnableNotifications() {
    setNotificationSupport(await requestNotificationPermission());
  }

  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      window.location.href = '/login';
      return;
    }
    setSession(current);
  }, []);

  // Blocks the whole dashboard behind ConsentGateModal until accepted — see that component for
  // why there's no "decline and continue" option. A failure here (e.g. no active policy
  // configured) fails open rather than locking everyone out over an unrelated outage.
  useEffect(() => {
    if (!session) return;
    getConsentStatus()
      .then(setConsentStatus)
      .catch(() => {});
  }, [session]);

  const loadProfiles = useCallback(
    async (options: { preserveActive: boolean } = { preserveActive: false }) => {
      if (!session) return;
      try {
        const [me, dependents] = await Promise.all([getProfile(session.userId), getDependents()]);
        const allProfiles = [me, ...dependents];
        setProfiles(allProfiles);

        if (options.preserveActive) {
          // The profile being viewed may be the one that was just deleted — deleted
          // dependents drop out of the list, and every request for them 404s — so fall back
          // to the user's own instead of staying on a profile that no longer exists.
          setActiveProfileId((current) =>
            current && allProfiles.some((profile) => profile.id === current) ? current : me.id
          );
          return;
        }

        // A reminder email links to /dashboard?profileId=X so a caregiver clicking it lands
        // on the dependent it was actually about, not their own profile by default.
        const requestedProfileId = new URLSearchParams(window.location.search).get('profileId');
        const requestedProfile = allProfiles.find((profile) => profile.id === requestedProfileId);
        setActiveProfileId(requestedProfile?.id ?? me.id);
      } catch {
        setError('No pudimos cargar tus perfiles. Intenta de nuevo.');
      }
    },
    [session]
  );

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const dependents = useMemo(
    () => profiles?.filter((profile) => profile.id !== session?.userId) ?? [],
    [profiles, session]
  );

  const isAdmin = useMemo(
    () => profiles?.find((profile) => profile.id === session?.userId)?.role === 'ADMIN',
    [profiles, session]
  );

  const loadDayData = useCallback(
    async (options: { showLoading: boolean } = { showLoading: true }) => {
      if (!activeProfileId) return;
      const requestId = ++loadRequestRef.current;
      const isoDate = toISODate(dateForDay(day));
      if (options.showLoading) setDoses(null);
      setError(null);

      try {
        const [doseList, summary, allergyList, card] = await Promise.all([
          getScheduledDoses(activeProfileId, isoDate),
          getAdherenceSummary(activeProfileId, isoDate),
          getAllergies(activeProfileId),
          getEmergencyCard(activeProfileId)
        ]);
        if (requestId !== loadRequestRef.current) return;
        setDoses(doseList);
        setAdherence(summary);
        setAllergies(allergyList);
        setEmergencyCard(card);
      } catch (err) {
        if (requestId !== loadRequestRef.current) return;
        // The backend's reason when it has one — e.g. a dependent who claimed their own
        // account and hasn't granted access (403), or a profile that no longer exists (404).
        setError(
          err instanceof ApiError && (err.status === 403 || err.status === 404)
            ? toSpanishMessage(err.message)
            : 'No pudimos cargar la información de este perfil.'
        );
      }
    },
    [activeProfileId, day]
  );

  // Switching profile must never leave the previous person's allergies, SOS card or
  // adherence on screen under the new name — not even while the new data loads, nor if
  // loading it fails (e.g. a dependent who withdrew access).
  useEffect(() => {
    setAllergies([]);
    setEmergencyCard(null);
    setAdherence(null);
    setDetailDoseId(null);
  }, [activeProfileId]);

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

  // Backend-driven changes (a dose auto-flipping to MISSED once its next occurrence comes
  // due, a caregiver on another device recording something) otherwise only show up on a
  // manual reload. Polling keeps the timeline in sync with reality on its own, without
  // resetting scroll position or flashing a loading state on every refresh.
  useEffect(() => {
    const interval = setInterval(() => loadDayData({ showLoading: false }), 60_000);
    return () => clearInterval(interval);
  }, [loadDayData]);

  // Only the earliest PENDING dose within each treatment can actually be recorded — every
  // later PENDING dose of that same treatment stays locked until it is. This is only a
  // best-effort guess restricted to today's list: it can't see a still-unresolved dose from
  // an earlier day, so it's paired with day === 'today' below (recording only ever happens
  // on today's view) and with surfacing the backend's real order-check error if the guess
  // was wrong (e.g. yesterday's dose is still pending).
  const actionableDoseIds = useMemo(() => {
    if (!doses || day !== 'today') return new Set<string>();
    const earliestPerTreatment = new Map<string, ScheduledDose>();
    for (const dose of doses) {
      if (dose.status !== 'PENDING') continue;
      const current = earliestPerTreatment.get(dose.treatmentId);
      if (!current || Date.parse(dose.scheduledAt) < Date.parse(current.scheduledAt)) {
        earliestPerTreatment.set(dose.treatmentId, dose);
      }
    }
    return new Set(Array.from(earliestPerTreatment.values()).map((dose) => dose.id));
  }, [doses, day]);

  // Fires the two foreground notifications as the live clock crosses each threshold — only
  // for today's still-pending doses, and only once per dose per threshold per session.
  useEffect(() => {
    if (notificationSupport !== 'granted' || day !== 'today' || !doses) return;

    for (const dose of doses) {
      if (dose.status !== 'PENDING') continue;
      const minutesUntil = (new Date(dose.scheduledAt).getTime() - now.getTime()) / 60000;

      const upcomingKey = `upcoming:${dose.id}`;
      if (minutesUntil <= UPCOMING_NOTIFICATION_MINUTES && minutesUntil > 0 && !notifiedRef.current.has(upcomingKey)) {
        notifiedRef.current.add(upcomingKey);
        notify('Se acerca una dosis', `${dose.medicationName} (${dose.dosage}) a las ${formatTime(dose.scheduledAt)}`);
      }

      const dueKey = `due:${dose.id}`;
      if (minutesUntil <= 0 && minutesUntil > -DUE_NOTIFICATION_GRACE_MINUTES && !notifiedRef.current.has(dueKey)) {
        notifiedRef.current.add(dueKey);
        notify('Es hora de una dosis', `${dose.medicationName} (${dose.dosage})`);
      }
    }
  }, [now, doses, day, notificationSupport]);

  async function handleRecord(doseId: string, status: 'TAKEN' | 'SKIPPED', notes: string) {
    if (!activeProfileId) return;
    setSavingDoseId(doseId);
    setError(null);
    try {
      const updated = await updateDoseStatus(activeProfileId, doseId, { status, notes: notes || undefined });
      setDoses((current) => current?.map((dose) => (dose.id === doseId ? updated : dose)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? toSpanishMessage(err.message) : 'No pudimos registrar la dosis. Intenta de nuevo.');
      return;
    } finally {
      setSavingDoseId(null);
    }
    // The dose is already saved at this point — a failed summary refresh must not be reported
    // as "No pudimos registrar la dosis"; the next poll will catch the percentage up.
    refreshAdherence();
  }

  function refreshAdherence() {
    if (!activeProfileId) return;
    getAdherenceSummary(activeProfileId, toISODate(dateForDay(day)))
      .then(setAdherence)
      .catch(() => {});
  }

  function handleDoseCorrected(updated: ScheduledDose) {
    setDoses((current) => current?.map((dose) => (dose.id === updated.id ? updated : dose)) ?? null);
    setDetailDoseId(null);
    refreshAdherence();
  }

  // The SOS card lists the allergies too, so it's refetched after every allergy change —
  // otherwise "Ver Ficha SOS" would show the old list until the next poll.
  function refreshEmergencyCard() {
    if (!activeProfileId) return;
    getEmergencyCard(activeProfileId)
      .then(setEmergencyCard)
      .catch(() => {});
  }

  async function handleAddAllergy(description: string, severity: AllergySeverity) {
    if (!activeProfileId) return;
    const created = await addAllergy(activeProfileId, { description, severity });
    setAllergies((current) => [...current, created]);
    refreshEmergencyCard();
  }

  async function handleUpdateAllergy(allergyId: string, description: string, severity: AllergySeverity) {
    if (!activeProfileId) return;
    const updated = await updateAllergy(activeProfileId, allergyId, { description, severity });
    setAllergies((current) => current.map((allergy) => (allergy.id === allergyId ? updated : allergy)));
    refreshEmergencyCard();
  }

  // Throws on failure so the sidebar form can show the error and stay open.
  async function handleSaveEmergencyContact(name: string | null, phone: string | null) {
    if (!activeProfileId) return;
    await updateEmergencyContact(activeProfileId, { emergencyContactName: name, emergencyContactPhone: phone });
    setEmergencyCard(await getEmergencyCard(activeProfileId));
  }

  async function handleDeleteAllergy(allergyId: string) {
    if (!activeProfileId) return;
    await deleteAllergy(activeProfileId, allergyId);
    setAllergies((current) => current.filter((allergy) => allergy.id !== allergyId));
    refreshEmergencyCard();
  }

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }

  function handleProfileUpdated(newName: string) {
    setSession((current) => (current ? { ...current, name: newName } : current));
    const current = getSession();
    if (current) saveSession({ ...current, name: newName });
  }

  if (!session) return null;

  const activeProfile = profiles?.find((profile) => profile.id === activeProfileId);
  // Two different medications can legitimately share the exact same scheduledAt (e.g. two
  // treatments both created "starting now") — medication name as a tiebreaker keeps the list
  // in the same order on every render instead of it looking like it reshuffles itself.
  const sortedDoses = doses
    ? [...doses].sort(
        (a, b) =>
          Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.medicationName.localeCompare(b.medicationName)
      )
    : null;

  // Different medications can legitimately share the exact same scheduledAt — grouping them
  // under one shared time heading (instead of each repeating an identical-looking card right
  // after the other) makes it visually obvious they're distinct medications for the same
  // moment, not one card accidentally duplicated.
  const doseGroups: { scheduledAt: string; doses: ScheduledDose[] }[] = [];
  for (const dose of sortedDoses ?? []) {
    const lastGroup = doseGroups[doseGroups.length - 1];
    if (lastGroup && Date.parse(lastGroup.scheduledAt) === Date.parse(dose.scheduledAt)) {
      lastGroup.doses.push(dose);
    } else {
      doseGroups.push({ scheduledAt: dose.scheduledAt, doses: [dose] });
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-16">
      <header className="border-b border-border bg-surface-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={1.75} />
            <span className="text-lg font-bold text-primary">MediTrack</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profiles && activeProfileId && (
              <ProfileSwitcher profiles={profiles} activeProfileId={activeProfileId} onChange={setActiveProfileId} />
            )}
            {isAdmin && (
              <a
                href="/admin"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
                Administración
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted"
            >
              <UserCog className="h-4 w-4" strokeWidth={1.75} />
              Hola, {session.name}
            </button>
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 rounded-lg bg-danger-bg px-4 py-3 text-sm font-medium text-danger-strong">{error}</div>
        )}

        {notificationSupport === 'default' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-info px-4 py-3">
            <div className="flex items-start gap-2 text-sm text-text-secondary">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
              Activa las notificaciones del navegador para avisos cuando se acerque o llegue la
              hora de una toma. Solo funcionan mientras esta pestaña esté abierta — para cuando
              esté cerrada, los avisos llegan por correo.
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Activar
            </button>
          </div>
        )}

        {activeProfile && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-card p-5 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-text">{activeProfile.name}</h1>
              <p className="flex items-center gap-1.5 text-sm text-text-caption capitalize">
                {formatFullDate(now.toISOString())}
                <span className="flex items-center gap-1 normal-case text-text-muted">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {formatTime(now.toISOString())}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              {adherence && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-secondary">{adherence.percentage}%</p>
                  <p className="text-xs text-text-caption">
                    {adherence.taken} de {adherence.total} tomas
                    {adherence.missed > 0 ? ` · ${adherence.missed} perdida${adherence.missed === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowEmergencyModal(true)}
                className="flex h-11 items-center gap-2 rounded-lg border border-danger-bg-soft px-4 text-sm font-semibold text-danger-strong transition-colors hover:bg-danger-bg"
              >
                <ShieldAlert className="h-4 w-4" strokeWidth={1.75} />
                Ver Ficha SOS
              </button>
            </div>
          </div>
        )}

        <div className="mb-5">
          <ProtocolBanner />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DaySelector value={day} onChange={setDay} />
              {activeProfileId && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTreatmentsModal(true)}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted"
                  >
                    <ListChecks className="h-4 w-4" strokeWidth={1.75} />
                    Mis tratamientos
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdherenceHistoryModal(true)}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted"
                  >
                    <History className="h-4 w-4" strokeWidth={1.75} />
                    Historial
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddTreatmentModal(true)}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-muted"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                    Agregar medicamento
                  </button>
                </div>
              )}
            </div>

            {sortedDoses === null && !error && <p className="text-sm text-text-caption">Cargando…</p>}
            {sortedDoses?.length === 0 && (
              <p className="rounded-xl border border-border bg-surface-card p-6 text-center text-sm text-text-caption">
                No hay dosis programadas para este día.
              </p>
            )}

            <div className="flex flex-col gap-6">
              {doseGroups.map((group) => (
                <div key={group.scheduledAt} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <Clock className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.75} />
                    <span className="text-xs font-bold uppercase tracking-wide text-text-caption">
                      {formatTime(group.scheduledAt)}
                    </span>
                    {group.doses.length > 1 && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                        {group.doses.length} medicamentos
                      </span>
                    )}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <div className={`grid gap-3 ${group.doses.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                    {group.doses.map((dose) => (
                      <DoseCard
                        key={dose.id}
                        dose={dose}
                        isActionable={actionableDoseIds.has(dose.id)}
                        now={now}
                        saving={savingDoseId === dose.id}
                        onRecord={(status, notes) => handleRecord(dose.id, status, notes)}
                        onViewDetail={() => setDetailDoseId(dose.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4">
            {/* Keyed by profile so a half-filled allergy/contact form for one person can never
                be saved against another after switching profile. */}
            <DashboardSidebar
              key={activeProfileId ?? 'none'}
              emergencyCard={emergencyCard}
              onSaveEmergencyContact={handleSaveEmergencyContact}
              allergies={allergies}
              onScanClick={() => setShowScanModal(true)}
              onManageDependentsClick={() => setShowDependentsModal(true)}
              onAddAllergy={handleAddAllergy}
              onUpdateAllergy={handleUpdateAllergy}
              onDeleteAllergy={handleDeleteAllergy}
            />
          </div>
        </div>
      </main>

      {showEmergencyModal && emergencyCard && activeProfileId && (
        <EmergencyCardModal card={emergencyCard} profileId={activeProfileId} onClose={() => setShowEmergencyModal(false)} />
      )}

      {showAddTreatmentModal && activeProfileId && (
        <AddTreatmentModal
          profileId={activeProfileId}
          onClose={() => setShowAddTreatmentModal(false)}
          onCreated={() => loadDayData({ showLoading: false })}
        />
      )}

      {showScanModal && activeProfileId && (
        <ScanPrescriptionModal
          profileId={activeProfileId}
          onClose={() => setShowScanModal(false)}
          onCreated={() => loadDayData({ showLoading: false })}
        />
      )}

      {showDependentsModal && (
        <ManageDependentsModal
          dependents={dependents}
          onClose={() => setShowDependentsModal(false)}
          onChanged={() => loadProfiles({ preserveActive: true })}
        />
      )}

      {showTreatmentsModal && activeProfileId && (
        <ManageTreatmentsModal
          profileId={activeProfileId}
          onClose={() => setShowTreatmentsModal(false)}
          onChanged={() => loadDayData({ showLoading: false })}
        />
      )}

      {showAdherenceHistoryModal && activeProfileId && (
        <AdherenceHistoryModal profileId={activeProfileId} onClose={() => setShowAdherenceHistoryModal(false)} />
      )}

      {showAccountModal && (
        <AccountSettingsModal
          session={session}
          email={profiles?.find((profile) => profile.id === session.userId)?.email ?? null}
          hasDependents={dependents.length > 0}
          onClose={() => setShowAccountModal(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {detailDoseId && activeProfileId && (() => {
        const detailDose = doses?.find((dose) => dose.id === detailDoseId);
        return detailDose ? (
          <DoseDetailModal
            profileId={activeProfileId}
            dose={detailDose}
            onClose={() => setDetailDoseId(null)}
            onCorrected={handleDoseCorrected}
          />
        ) : null;
      })()}

      {consentStatus?.requiresAcceptance && (
        <ConsentGateModal
          status={consentStatus}
          onAccepted={() => setConsentStatus((current) => (current ? { ...current, requiresAcceptance: false } : current))}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
