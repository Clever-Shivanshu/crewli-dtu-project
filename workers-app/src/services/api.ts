import { API_BASE_URL } from '../config';
import { CachedWorker, getAuth, LatLng, useAuth } from '../store/auth';

export type { CachedWorker, LatLng } from '../store/auth';

export type Language = { code: string; label: string; native: string };
export type ProfessionSkill = {
  key: string;
  label: string;
  basePrice: number;
  perKmRate: number;
};
export type Profession = { key: string; label: string; skills: ProfessionSkill[] };

export type WorkerStats = {
  totalCompleted: number;
  jobsToday: number;
  earningsToday: number;
  earningsWeek: number;
  earningsMonth: number;
  earningsAll: number;
};

export type CommissionStatus = {
  balance: number;
  limit: number;
  prepaidCredit: number;
  isBlocked: boolean;
  completedJobs: number;
  currentRate: number; // 5, 8, or 10
};

export type JobWorker = {
  id: string;
  name: string;
  phone: string;
  imageUrl: string | null;
  rating: number;
  profession: string | null;
  location: LatLng | null;
};

export type Job = {
  id: string;
  skillKey: string;
  category: string;
  jobType: string;
  subProblemTitle: string | null;
  address: string;
  notes: string;
  status: string;
  basePrice: number;
  perKmRate: number;
  finalPrice: number | null;
  addOns?: string[];
  addOnsTotal?: number;
  customerPhone: string | null;
  customerName: string | null;
  customerLocation: LatLng | null;
  otp: string | null;
  otpVerified: boolean;
  otpVerifiedAt: string | null;
  overtimeCharge?: number; // deprecated, always 0
  createdAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelledBy: 'worker' | 'customer' | null;
  worker: JobWorker | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Refresh the access token if it's been more than 12h since the last refresh.
 * Non-throwing — failure just leaves the access token alone and the next 401
 * will trigger a hard refresh.
 */
export async function refreshIfStale() {
  const { refreshToken, lastRefreshAt } = getAuth();
  if (!refreshToken) return;
  const STALE_MS = 12 * 60 * 60 * 1000;
  if (Date.now() - lastRefreshAt < STALE_MS) return;
  await doRefresh().catch(() => {});
}

/** Forced refresh. Returns true on success. */
async function doRefresh(): Promise<boolean> {
  const { refreshToken } = getAuth();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      if (res.status === 401) useAuth.getState().clear();
      return false;
    }
    const json = await res.json();
    useAuth.setState({
      accessToken: json.accessToken,
      refreshToken: json.refreshToken,
      worker: json.worker ?? useAuth.getState().worker,
      lastRefreshAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean; retry?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
  };
  // Only set JSON content-type when we actually have a body — Fastify
  // rejects empty bodies when content-type is application/json (e.g. the
  // bodyless POSTs /jobs/:id/arrived, /payment-received, /cancel).
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false) {
    const t = getAuth().accessToken;
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  // 401 → try a refresh once, then retry the original call once.
  if (res.status === 401 && opts.auth !== false && !opts.retry) {
    const refreshed = await doRefresh();
    if (refreshed) return request<T>(path, { ...opts, retry: true });
    useAuth.getState().clear();
  }

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || `HTTP ${res.status}`);
  return json as T;
}

export const api = {
  // ---- catalog ----
  getLanguages: () =>
    request<{ languages: Language[] }>('/catalog/languages', { auth: false }),
  getProfessions: () =>
    request<{ professions: Profession[] }>('/catalog/professions', { auth: false }),
  getCatalog: () =>
    request<{ problems: any[]; skills: Record<string, any> }>('/catalog', { auth: false }),

  // ---- auth ----
  requestOtp: (phone: string) =>
    request<{ ok: boolean; devOtp?: string }>('/auth/request-otp', {
      method: 'POST',
      body: { phone },
      auth: false,
    }),
  checkPhone: (phone: string) =>
    request<{ exists: boolean; onboarded: boolean }>('/auth/check-phone', {
      method: 'POST',
      body: { phone },
      auth: false,
    }),
  login: (args: {
    phone: string;
    otp: string;
    name?: string;
    fcmToken?: string;
    location?: LatLng;
  }) =>
    request<{
      accessToken: string;
      refreshToken: string;
      worker: CachedWorker;
    }>('/auth/login', { method: 'POST', body: args, auth: false }),
  logout: () =>
    request('/auth/logout', {
      method: 'POST',
      body: { refreshToken: getAuth().refreshToken },
    }),
  sendFcmToken: (fcmToken: string) =>
    request('/auth/fcm-token', { method: 'POST', body: { fcmToken } }),

  // ---- worker ----
  me: () => request<CachedWorker>('/worker/me'),
  workerStats: () => request<WorkerStats>('/worker/stats'),
  profile: () => request<CachedWorker>('/worker/profile'),
  updateProfile: (patch: {
    name?: string;
    language?: string;
    profession?: string;
    skills?: string[];
    imageUrl?: string | null;
    location?: LatLng;
  }) => request<CachedWorker>('/worker/profile', { method: 'PATCH', body: patch }),
  onboard: (body: {
    language: string;
    profession: string;
    skills: string[];
    name?: string;
    location?: LatLng;
  }) => request<CachedWorker>('/worker/onboard', { method: 'POST', body }),
  toggle: (isAvailable: boolean, location?: LatLng) =>
    request<{ ok: boolean; isAvailable: boolean }>('/worker/toggle', {
      method: 'POST',
      body: { isAvailable, location },
    }),
  heartbeat: (location?: LatLng) =>
    request<{ ok: boolean; isAvailable: boolean }>('/worker/heartbeat', {
      method: 'POST',
      body: location ? { location } : undefined,
    }),

  // ---- jobs ----
  accept: (jobId: string) =>
    request('/jobs/accept', { method: 'POST', body: { jobId } }),
  reject: (jobId: string) =>
    request('/jobs/reject', { method: 'POST', body: { jobId } }),
  myJobs: () => request<{ jobs: Job[] }>('/jobs/mine'),
  nearbyJobs: () => request<{ jobs: Job[] }>('/jobs/nearby'),
  acceptJob: (jobId: string) =>
    request<{ job: Job }>('/jobs/accept', { method: 'POST', body: { jobId } }),
  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),
  jobArrived: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/arrived`, { method: 'POST' }),
  jobComplete: (jobId: string, finalPrice?: number) =>
    request<Job>(`/jobs/${jobId}/complete`, {
      method: 'POST',
      body: finalPrice != null ? { finalPrice } : {},
    }),
  jobPaymentReceived: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/payment-received`, { method: 'POST' }),
  jobCancel: (jobId: string) =>
    request<Job>(`/jobs/${jobId}/cancel`, { method: 'POST' }),
  verifyOtp: (jobId: string, otp: string) =>
    request<Job>(`/jobs/${jobId}/verify-otp`, { method: 'POST', body: { otp } }),

  // ---- commission ----
  getCommission: () =>
    request<CommissionStatus>('/worker/commission'),
  payCommission: (amount: number) =>
    request<{
      ok: boolean;
      newBalance: number;
      prepaidCredit: number;
      limit: number;
      isBlocked: boolean;
      bonusCreditAdded: number;
    }>('/worker/commission/pay', { method: 'POST', body: { amount } }),

  // ---- live location (worker → customer via socket room) ----
  sendWorkerLocation: (loc: LatLng, jobId?: string) =>
    request<{ ok: boolean }>('/worker/location', {
      method: 'POST',
      body: { ...loc, jobId },
    }),

  // ---- uploads ----
  getUploadSignature: () =>
    request<{
      cloudName: string;
      apiKey: string;
      timestamp: number;
      folder: string;
      publicId: string | null;
      signature: string;
      uploadUrl: string;
    }>('/worker/upload-signature', { method: 'POST' }),
  
  uploadImage: (base64: string) =>
    request<{ url: string }>('/upload', {
      method: 'POST',
      body: { base64 },
    }),
};

/** Direct Cloudinary signed upload. */
export async function uploadImageToCloudinary(localUri: string): Promise<string> {
  const sig = await api.getUploadSignature();
  const form = new FormData();
  form.append('file', { uri: localUri, type: 'image/jpeg', name: 'dp.jpg' } as any);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  if (sig.publicId) form.append('public_id', sig.publicId);
  form.append('signature', sig.signature);

  const res = await fetch(sig.uploadUrl, { method: 'POST', body: form as any });
  const json: any = await res.json();
  if (!res.ok || !json.secure_url) {
    throw new Error(json?.error?.message || 'upload_failed');
  }
  return json.secure_url as string;
}

// Back-compat helpers for screens that still reference these.
export async function cacheWorker(w: CachedWorker) {
  useAuth.getState().setWorker(w);
}
export async function loadCachedWorker() {
  return getAuth().worker;
}
export async function getToken() {
  return getAuth().accessToken;
}
export async function clearToken() {
  useAuth.getState().clear();
}
export async function setToken() {
  /* no-op: login now stores access+refresh directly in the store */
}
