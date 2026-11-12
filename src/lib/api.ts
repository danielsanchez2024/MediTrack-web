// Thin client for MediTrack's backend. Every call goes through the relative /api/v1/* path —
// that's the same path nginx proxies in docker-compose, and the Vite dev server proxies the
// same way in astro.config.mjs, so the backend never needs CORS configured for this to work.

import { clientTimeZone } from './date';
import { clearSession, getSession, saveSession, type Session } from './session';

export interface ApiErrorBody {
  status: number;
  error: string;
  message: string;
  details?: string[];
}

export class ApiError extends Error {
  status: number;
  details: string[];

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.status = body.status;
    this.details = body.details ?? [];
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      body = {
        status: response.status,
        error: 'Error',
        message: 'Ocurrió un error inesperado. Intenta de nuevo en un momento.'
      };
    }
    throw new ApiError(body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Refresh tokens are single-use — the backend revokes the old one the instant it's redeemed
// (RefreshTokenService), so two requests that both hit a 401 at the same moment (e.g. the
// dashboard's parallel Promise.all fetches) must not each try to redeem it themselves: the
// second one would arrive at an already-revoked token and fail for real. Every 401 handler
// below awaits this same in-flight promise instead of starting its own.
let refreshInFlight: Promise<Session | null> | null = null;

function refreshSession(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight;

  const session = getSession();
  if (!session) return Promise.resolve(null);

  refreshInFlight = request<LoginResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken })
  })
    .then((result) => {
      saveSession(result);
      return result;
    })
    .catch(() => {
      // The refresh token itself is gone too — genuinely expired (30 days by default), or
      // revoked by a logout-all/password-reset elsewhere. Nothing left to try.
      clearSession();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function goToLogin(): void {
  clearSession();
  window.location.href = '/login?sessionExpired=1';
}

// For every endpoint that needs a logged-in user. The access token is short-lived by design
// (an hour by default) — a tab left open longer than that shouldn't force a re-login on its
// own, so a 401 first tries a silent refresh (the refresh token lasts weeks) and retries the
// same request once with the new access token. Only sends the person back to /login if that
// refresh also fails — i.e. there's truly no valid session left to recover.
async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  try {
    return await request<T>(path, {
      ...options,
      headers: {
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (session) {
        const refreshed = await refreshSession();
        if (refreshed) {
          return request<T>(path, {
            ...options,
            headers: { Authorization: `Bearer ${refreshed.token}`, ...options.headers }
          });
        }
      }
      goToLogin();
    }
    throw error;
  }
}

// Same as authRequest, but for a multipart body — deliberately doesn't go through request()'s
// default 'Content-Type': 'application/json' header, since the browser needs to set its own
// multipart boundary on the Content-Type header itself. Same silent-refresh-then-retry
// behavior on a 401 as authRequest — a FormData instance is safe to send more than once, it's
// not a stream that gets consumed.
async function authUploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const session = getSession();

  async function doUpload(token: string | undefined): Promise<Response> {
    try {
      return await fetch(`/api/v1${path}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
    } catch {
      throw new ApiError({ status: 0, error: 'Network Error', message: 'No pudimos conectar con el servidor.' });
    }
  }

  let response = await doUpload(session?.token);

  if (response.status === 401 && session) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await doUpload(refreshed.token);
    }
  }

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      body = { status: response.status, error: 'Error', message: 'Ocurrió un error inesperado. Intenta de nuevo en un momento.' };
    }
    if (response.status === 401) {
      goToLogin();
    }
    throw new ApiError(body);
  }

  return response.json() as Promise<T>;
}

// Same 401-then-silent-refresh behavior as authRequest, but for a binary response (a PDF)
// instead of JSON — returns the raw Blob for the caller to turn into a download.
async function authDownload(path: string): Promise<Blob> {
  const session = getSession();

  async function doFetch(token: string | undefined): Promise<Response> {
    try {
      return await fetch(`/api/v1${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch {
      throw new ApiError({ status: 0, error: 'Network Error', message: 'No pudimos conectar con el servidor.' });
    }
  }

  let response = await doFetch(session?.token);

  if (response.status === 401 && session) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await doFetch(refreshed.token);
    }
  }

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      body = { status: response.status, error: 'Error', message: 'Ocurrió un error inesperado. Intenta de nuevo en un momento.' };
    }
    if (response.status === 401) {
      goToLogin();
    }
    throw new ApiError(body);
  }

  return response.blob();
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: string;
  name: string;
}

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// Revokes this device's refresh token on the server before forgetting the session locally —
// otherwise a copied refresh token would stay valid for weeks after "Salir". Best effort: a
// failed network call must never keep someone from logging out.
export async function logout(): Promise<void> {
  const session = getSession();
  if (session) {
    await request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken })
    }).catch(() => {});
  }
  clearSession();
}

// Ends every session of this account, on every device (stolen phone, shared computer).
export async function logoutAllDevices(): Promise<void> {
  await authRequest<void>('/auth/logout-all', { method: 'POST' });
  clearSession();
}

export function requestPasswordReset(email: string): Promise<void> {
  return request<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  healthDataConsentAccepted: boolean;
}

export interface RegisterResponse {
  id: string;
  name: string;
  email: string;
}

export function register(payload: RegisterRequest): Promise<RegisterResponse> {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

export function resetPassword(payload: ResetPasswordRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export interface ClaimAccountRequest {
  claimToken: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function claimAccount(payload: ClaimAccountRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/claim-account', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// --- Dashboard ---

export type UserRole = 'USER' | 'ADMIN';

export interface ProfileSummary {
  id: string;
  name: string;
  email: string | null;
  profileType: 'AUTONOMOUS' | 'ASSISTED';
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  claimed: boolean;
  role: UserRole;
}

export function getProfile(profileId: string): Promise<ProfileSummary> {
  return authRequest(`/users/${profileId}`);
}

export function getDependents(): Promise<ProfileSummary[]> {
  return authRequest('/users/dependents');
}

export interface DependentRequest {
  name: string;
  email?: string;
}

export function createDependent(payload: DependentRequest): Promise<ProfileSummary> {
  return authRequest('/users/dependents', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export interface DependentInvite {
  claimToken: string;
  expiresAt: string;
}

// Calling this again for the same dependent invalidates whichever token was issued before —
// there's never more than one valid invite code per profile at a time, so it's safe to call
// without first checking whether one is already pending.
export function inviteDependent(dependentId: string): Promise<DependentInvite> {
  return authRequest(`/users/dependents/${dependentId}/invite`, { method: 'POST' });
}

// Idempotent — a 204 either way, whether or not an invite was actually pending.
export function cancelDependentInvite(dependentId: string): Promise<void> {
  return authRequest(`/users/dependents/${dependentId}/invite`, { method: 'DELETE' });
}

// MISSED is set only by the backend's own sweep (ScheduledDoseService.markMissedDoses) when a
// dose was never recorded and its treatment's next occurrence has already come due — the
// frontend only ever reads it, never sends it as a status to record.
export type DoseStatus = 'PENDING' | 'TAKEN' | 'SKIPPED' | 'MISSED';
export type RecordableStatus = 'PENDING' | 'TAKEN' | 'SKIPPED';

export interface ScheduledDose {
  id: string;
  treatmentId: string;
  medicationName: string;
  dosage: string;
  instructions: string | null;
  scheduledAt: string;
  status: DoseStatus;
  recordedAt: string | null;
  notes: string | null;
  recordedByName: string | null;
  withinWindow: boolean;
  correctable: boolean;
  recordable: boolean;
  remainingQuantity: number | null;
}

export function getScheduledDoses(profileId: string, date?: string): Promise<ScheduledDose[]> {
  const params = new URLSearchParams({ profileId, tz: clientTimeZone() });
  if (date) params.set('date', date);
  return authRequest(`/scheduled-doses?${params.toString()}`);
}

// startDate/endDate together take precedence over a single date on the backend — used for
// reviewing adherence history over more than one day (e.g. "last week", "last month").
export function getScheduledDosesInRange(profileId: string, startDate: string, endDate: string): Promise<ScheduledDose[]> {
  const params = new URLSearchParams({ profileId, startDate, endDate, tz: clientTimeZone() });
  return authRequest(`/scheduled-doses?${params.toString()}`);
}

export interface DoseUpdatePayload {
  status: RecordableStatus;
  notes?: string;
}

export function updateDoseStatus(
  profileId: string,
  doseId: string,
  payload: DoseUpdatePayload
): Promise<ScheduledDose> {
  return authRequest(`/scheduled-doses/${doseId}?profileId=${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export interface AdherenceSummary {
  total: number;
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  percentage: number;
}

export function getAdherenceSummary(profileId: string, date?: string): Promise<AdherenceSummary> {
  const params = new URLSearchParams({ profileId, tz: clientTimeZone() });
  if (date) params.set('date', date);
  return authRequest(`/scheduled-doses/summary?${params.toString()}`);
}

export function getAdherenceSummaryInRange(profileId: string, startDate: string, endDate: string): Promise<AdherenceSummary> {
  const params = new URLSearchParams({ profileId, startDate, endDate, tz: clientTimeZone() });
  return authRequest(`/scheduled-doses/summary?${params.toString()}`);
}

export type FrequencyUnit = 'MINUTES' | 'HOURS' | 'DAYS';

export interface Treatment {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions: string | null;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  startDate: string;
  endDate: string | null;
  registrationSource: 'SCAN' | 'MANUAL';
  active: boolean;
  totalQuantity: number | null;
  quantityPerDose: number;
  remainingQuantity: number | null;
}

export interface TreatmentRequest {
  medicationName: string;
  dosage: string;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  startDate: string;
  firstDoseAlreadyTaken?: boolean;
  endDate?: string;
  instructions?: string;
  // Omit both to keep scheduling purely off the rolling time window, same as before this
  // existed — total supply, not just "how many so far", is what caps how many future doses
  // ever get generated.
  totalQuantity?: number;
  quantityPerDose?: number;
  // Set when the user is confirming (possibly edited) data from POST /prescriptions/scan —
  // a provenance flag, not a "verified" flag: it's still true even if every field was edited
  // before confirming.
  fromPrescriptionScan?: boolean;
}

export function getTreatments(profileId: string): Promise<Treatment[]> {
  return authRequest(`/treatments?profileId=${profileId}`);
}

export function createTreatment(profileId: string, payload: TreatmentRequest): Promise<Treatment> {
  return authRequest(`/treatments?profileId=${profileId}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// Only these fields can be changed after creation — medicationName, quantity tracking and
// registrationSource are fixed at creation time. Omitting a field (undefined, not '') leaves
// it unchanged server-side; changing frequency or endDate wipes and regenerates pending doses.
export interface TreatmentUpdateRequest {
  dosage?: string;
  frequencyValue?: number;
  frequencyUnit?: FrequencyUnit;
  endDate?: string;
  // endDate alone can't express "remove the existing one" (omitting it already means "leave
  // unchanged") — set this to actually clear it, e.g. switching back to continuous/chronic use.
  clearEndDate?: boolean;
  instructions?: string;
}

export function updateTreatment(
  profileId: string,
  treatmentId: string,
  payload: TreatmentUpdateRequest
): Promise<Treatment> {
  return authRequest(`/treatments/${treatmentId}?profileId=${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deactivateTreatment(profileId: string, treatmentId: string): Promise<void> {
  return authRequest(`/treatments/${treatmentId}/deactivate?profileId=${profileId}`, {
    method: 'PATCH'
  });
}

// --- Medications ---
// Medications are a shared, de-duplicated catalog, not per-user data — no profileId here, same
// as the backend (see MedicationDetailService).

export interface MedicationDetail {
  id: string;
  commercialName: string;
  cumCode: string | null;
  activeIngredient: string | null;
  pharmaceuticalForm: string | null;
  administrationRoute: string | null;
  atcGroup: string | null;
  source: 'INVIMA' | 'MANUAL';
  description: string | null;
  aiGenerated: boolean;
}

export function getMedicationDetail(medicationId: string): Promise<MedicationDetail> {
  return authRequest(`/medications/${medicationId}`);
}

// --- Prescription scan ---

// Mirrors ScannedMedicationDTO — any field the vision model couldn't find in the image comes
// back null, never guessed, so the review form shows it blank instead of something wrong.
export interface ScannedMedication {
  medicationName: string | null;
  dosage: string | null;
  frequencyHours: number | null;
  durationDays: number | null;
}

// A real prescription commonly lists more than one medication — every one the model could
// find comes back here, in the order they appear in the image.
export interface PrescriptionScanResult {
  medications: ScannedMedication[];
}

// The image never gets saved anywhere by itself — this call only returns extracted text for
// the user to review/correct; nothing is persisted until each draft is confirmed via
// createTreatment(..., { fromPrescriptionScan: true }). Can take ~15-20s (CPU-bound vision
// model on the backend), so callers should show a patient loading state, not a short spinner.
export function scanPrescription(image: File, dataSharingConsent = false): Promise<PrescriptionScanResult> {
  const formData = new FormData();
  formData.append('image', image);
  // The backend refuses (400) to send the photo to a provider whose data handling nobody
  // verified unless the user agreed — see getScanProviderInfo / consentRequired.
  formData.append('dataSharingConsent', String(dataSharingConsent));
  return authUploadRequest('/prescriptions/scan', formData);
}

// Who reads the prescription photo and what is known about their data handling, so the screen can
// say it before the user picks a photo. Mirrors ScanProviderInfoDTO (no model, host or key).
export interface ScanProviderInfo {
  provider: string;
  dataPolicy: 'verified' | 'unverified';
  consentRequired: boolean;
  // False while an admin has paused scanning (the scan then answers 503). Absent on older backends.
  available?: boolean;
}

export function getScanProviderInfo(): Promise<ScanProviderInfo> {
  return authRequest('/prescriptions/provider');
}

export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export interface Allergy {
  id: string;
  description: string;
  severity: AllergySeverity;
}

export function getAllergies(profileId: string): Promise<Allergy[]> {
  return authRequest(`/users/allergies?profileId=${profileId}`);
}

export interface AllergyRequest {
  description: string;
  severity: AllergySeverity;
}

export function addAllergy(profileId: string, payload: AllergyRequest): Promise<Allergy> {
  return authRequest(`/users/allergies?profileId=${profileId}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateAllergy(profileId: string, allergyId: string, payload: AllergyRequest): Promise<Allergy> {
  return authRequest(`/users/allergies/${allergyId}?profileId=${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteAllergy(profileId: string, allergyId: string): Promise<void> {
  return authRequest(`/users/allergies/${allergyId}?profileId=${profileId}`, { method: 'DELETE' });
}

export function getInactiveTreatments(profileId: string): Promise<Treatment[]> {
  return authRequest(`/treatments/inactive?profileId=${profileId}`);
}

// --- Self-account management ---

export interface CaregiverMonitoringStatus {
  hasCaregiver: boolean;
  caregiverName: string | null;
  granted: boolean;
}

export function getCaregiverMonitoringStatus(): Promise<CaregiverMonitoringStatus> {
  return authRequest('/users/consents/caregiver-monitoring');
}

export function setCaregiverMonitoringConsent(granted: boolean): Promise<void> {
  return authRequest('/users/consents/caregiver-monitoring', {
    method: 'PATCH',
    body: JSON.stringify({ granted })
  });
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export function updateProfile(payload: UpdateProfileRequest): Promise<ProfileSummary> {
  return authRequest('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export interface ConsentStatus {
  requiresAcceptance: boolean;
  policyId: string;
  version: string;
  contentUrl: string | null;
}

export function getConsentStatus(): Promise<ConsentStatus> {
  return authRequest('/users/me/consent-status');
}

export function acceptCurrentPrivacyPolicy(): Promise<ConsentStatus> {
  return authRequest('/users/me/consent-status/accept', { method: 'POST' });
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Returns a fresh token pair — the current session stays logged in seamlessly, but every
// other session (and the pre-change access token, once it would otherwise have expired
// naturally) is invalidated server-side. Callers must save this as the new session.
export function changePassword(payload: ChangePasswordRequest): Promise<LoginResponse> {
  return authRequest('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteOwnAccount(): Promise<void> {
  return authRequest('/auth/account', { method: 'DELETE' });
}

export function deleteDependent(dependentId: string): Promise<void> {
  return authRequest(`/users/dependents/${dependentId}`, { method: 'DELETE' });
}

export interface EmergencyCardTreatment {
  id: string;
  medicationName: string;
  dosage: string;
  instructions: string | null;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
}

export interface EmergencyCardAllergy {
  description: string;
  severity: AllergySeverity;
}

export interface EmergencyCard {
  name: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  // Most severe first — the backend sorts these so the thing that matters most in an
  // emergency isn't buried at the bottom of the list.
  allergies: EmergencyCardAllergy[];
  activeTreatments: EmergencyCardTreatment[];
}

// Both fields are replaced as given — null for both removes the contact. The one emergency
// contact shown on the SOS card (and its PDF), for the user or a dependent they manage.
export function updateEmergencyContact(
  profileId: string,
  contact: { emergencyContactName: string | null; emergencyContactPhone: string | null }
): Promise<void> {
  return authRequest(`/users/emergency-contact?profileId=${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(contact)
  });
}

export function getEmergencyCard(profileId: string): Promise<EmergencyCard> {
  return authRequest(`/emergency-card?profileId=${profileId}`);
}

// The PDF itself renders in well under a second (it's formatting a handful of already-fetched
// fields, not calling anything AI/network-heavy) — this call is a normal fetch, so it never
// blocks the rest of the page; the caller just shows a brief loading state around it.
export function getEmergencyCardPdf(profileId: string): Promise<Blob> {
  return authDownload(`/emergency-card/pdf?profileId=${profileId}`);
}

// --- Admin ---
// Deliberately scoped: account metadata and privacy-policy versions only. There is no admin
// endpoint anywhere for treatments, doses, allergies, or the emergency card — an admin cannot
// see anyone's health data, by design.

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  profileType: 'AUTONOMOUS' | 'ASSISTED';
  role: UserRole;
  active: boolean;
  claimed: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserPage {
  items: AdminUserSummary[];
  total: number;
  page: number;
  size: number;
}

// Paged and searched on the server: the list never loads every account at once.
export function getAdminUsers(query = '', page = 0, size = 50): Promise<AdminUserPage> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set('q', query.trim());
  return authRequest(`/admin/users?${params}`);
}

// Aggregate counts only — no per-user health data, consistent with the rest of the admin scope.
export interface PlatformUsageSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  usersActiveLast7Days: number;
  usersActiveLast30Days: number;
  activeTreatments: number;
  dosesRecordedLast7Days: number;
  dosesRecordedLast30Days: number;
}

export function getPlatformUsage(): Promise<PlatformUsageSummary> {
  return authRequest('/admin/usage');
}

export function setAdminUserActive(userId: string, active: boolean): Promise<AdminUserSummary> {
  return authRequest(`/admin/users/${userId}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active })
  });
}

export function setAdminUserRole(userId: string, role: UserRole): Promise<AdminUserSummary> {
  return authRequest(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

export type ConsentType = 'HEALTH_DATA_PROCESSING' | 'CAREGIVER_MONITORING';

export interface PrivacyPolicy {
  id: string;
  policyType: ConsentType;
  version: string;
  contentUrl: string | null;
  active: boolean;
  publishedAt: string;
}

export function getPrivacyPolicies(): Promise<PrivacyPolicy[]> {
  return authRequest('/admin/privacy-policies');
}

export interface CreatePrivacyPolicyRequest {
  policyType: ConsentType;
  version: string;
  contentUrl?: string;
}

export function createPrivacyPolicy(payload: CreatePrivacyPolicyRequest): Promise<PrivacyPolicy> {
  return authRequest('/admin/privacy-policies', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// How this account wants dose reminders, per channel. Email and SMS are sent by the backend;
// push is the notification bell: the browser's reminders while the tab is open and the phone
// app's own notifications. The preference belongs to the account — the bell's switch on the web and
// the phone's settings both write it, and the phone asks the OS for its permission by itself.
export type ReminderTiming = 'BEFORE' | 'AT_TIME' | 'BOTH';

export interface NotificationPreferences {
  emailEnabled: boolean;
  emailTiming: ReminderTiming;
  smsEnabled: boolean;
  smsTiming: ReminderTiming;
  phoneNumber: string | null;
  pushEnabled: boolean;
  pushTiming: ReminderTiming;
  includeDependents: boolean;
}

export function getNotificationPreferences(): Promise<NotificationPreferences> {
  return authRequest('/users/me/notification-preferences');
}

export function updateNotificationPreferences(payload: NotificationPreferences): Promise<NotificationPreferences> {
  return authRequest('/users/me/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

// --- Admin operations (traffic, flows, system, emergency switches, audit) ---
// Everything here is aggregate: request counts per endpoint pattern, status codes, timings and
// platform settings. There is no user, IP address, email or health data in any of these payloads.

export type OpsRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface OpsTotals {
  requests: number;
  errors4xx: number;
  errors5xx: number;
  rateLimited: number;
  unauthorized: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface OpsTrafficPoint {
  at: string;
  requests: number;
  errors4xx: number;
  errors5xx: number;
  rateLimited: number;
  unauthorized: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  heapUsedMb: number | null;
  cpuPct: number | null;
}

export interface OpsTrafficSeries {
  range: OpsRange;
  bucketSeconds: number;
  points: OpsTrafficPoint[];
  totals: OpsTotals;
}

export interface OpsEndpointStat {
  endpoint: string;
  count: number;
  errors4xx: number;
  errors5xx: number;
  avgMs: number;
  statuses: Record<string, number>;
}

export interface OpsFlows {
  range: OpsRange;
  flows: Record<string, Record<string, number>>;
}

export interface OpsSwitchState {
  key: string;
  enabled: boolean;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface OpsSystemStatus {
  uptimeSeconds: number;
  heapUsedMb: number;
  heapMaxMb: number;
  threads: number;
  cpuLoadPct: number | null;
  dbUp: boolean;
  dbPingMs: number;
  dbSizeMb: number | null;
  dbPoolActive: number | null;
  dbPoolIdle: number | null;
  dbPoolMax: number | null;
  javaVersion: string;
  environment: string;
}

export interface OpsAiStatus {
  provider: string;
  dataPolicy: 'verified' | 'unverified';
  scanEnabled: boolean;
  scansToday: number;
  maxPerDay: number;
  maxPerUserPerDay: number;
  scansLastMinute: number;
  maxPerMinute: number;
  inFlight: number;
  maxConcurrent: number;
}

export interface OpsOverview {
  system: OpsSystemStatus;
  last5Minutes: OpsTotals;
  lastHour: OpsTotals;
  ai: OpsAiStatus;
  limits: { rateLimitEnabled: boolean; rateLimiterTrackedKeys: number };
  switches: OpsSwitchState[];
}

export interface OpsAuditEntry {
  id: string;
  at: string;
  adminEmail: string;
  action: string;
  target: string | null;
  details: string | null;
}

export function getOpsOverview(): Promise<OpsOverview> {
  return authRequest('/admin/ops/overview');
}

export function getOpsTraffic(range: OpsRange): Promise<OpsTrafficSeries> {
  return authRequest(`/admin/ops/traffic?range=${range}`);
}

export function getOpsEndpoints(range: OpsRange): Promise<OpsEndpointStat[]> {
  return authRequest(`/admin/ops/endpoints?range=${range}`);
}

export function getOpsFlows(range: OpsRange): Promise<OpsFlows> {
  return authRequest(`/admin/ops/flows?range=${range}`);
}

export function getOpsSwitches(): Promise<OpsSwitchState[]> {
  return authRequest('/admin/ops/switches');
}

// Turning a switch off needs a reason: it affects every user and it goes into the audit trail.
export function setOpsSwitch(key: string, enabled: boolean, reason: string): Promise<OpsSwitchState> {
  return authRequest(`/admin/ops/switches/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled, reason: reason.trim() || null })
  });
}

export function getOpsAudit(limit = 50): Promise<OpsAuditEntry[]> {
  return authRequest(`/admin/ops/audit?limit=${limit}`);
}
