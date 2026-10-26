import { API_BASE_URL } from '../config';

export type LatLng = { lat: number; lng: number };

export type Skill = {
  label: string;
  profession: string;
  category: string;
  basePrice: number;
  perKmRate: number;
};

export type SubProblem = {
  id: string;
  title: string;
  skillKey: string;
};

export type Problem = {
  id: string;
  title: string;
  category: string;
  subProblems: SubProblem[];
};

export type AddOn = {
  id: string;
  label: string;
  price: number;
};

export type Catalog = {
  problems: Problem[];
  skills: Record<string, Skill>;
  addOns: AddOn[];
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

export type JobStatus =
  | 'pending'
  | 'accepted'
  | 'arrived'
  | 'completed'
  | 'paid'
  | 'expired'
  | 'cancelled';

export type Job = {
  id: string;
  skillKey: string;
  category: string;
  jobType: string;
  subProblemTitle: string | null;
  address: string;
  notes: string;
  status: JobStatus | string;
  basePrice: number;
  perKmRate: number;
  finalPrice: number | null;
  addOns: string[];
  addOnsTotal: number;
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

async function request<T>(
  path: string,
  opts: { method?: string; body?: any } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
  };
  // Only set JSON content-type when we actually have a body — Fastify
  // rejects empty bodies when content-type is application/json (e.g. the
  // bodyless POST /jobs/:id/customer-cancel).
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || `HTTP ${res.status}`);
  return json as T;
}

export type NearestEta = {
  available: boolean;
  etaMin: number | null;
  distanceKm: number | null;
};

export const api = {
  // ---- catalog ----
  getCatalog: () => request<Catalog>('/catalog'),

  getNearestEta: (lat: number, lng: number) =>
    request<NearestEta>(`/catalog/nearest-eta?lat=${lat}&lng=${lng}`),

  // ---- auth ----
  requestOtp: (phone: string) =>
    request<{ ok: boolean; devOtp?: string }>('/auth/request-otp', {
      method: 'POST',
      body: { phone },
    }),
  verifyOtp: (phone: string, otp: string) =>
    request<{ ok: boolean; phone: string; customerId: string; profile: any }>('/auth/customer-verify-otp', {
      method: 'POST',
      body: { phone, otp },
    }),
  getProfile: (customerId: string) =>
    request<any>(`/auth/customer-profile?customerId=${encodeURIComponent(customerId)}`),
  updateProfile: (customerId: string, data: { name?: string; address?: string; location?: LatLng; imageUrl?: string | null; savedAddresses?: any[] }) =>
    request<{ ok: boolean }>('/auth/customer-update-profile', {
      method: 'POST',
      body: { customerId, ...data },
    }),

  // ---- jobs ----
  createJob: (body: {
    subProblemId?: string;
    skillKey?: string;
    customerLocation: LatLng;
    customerId?: string | null;
    customerPhone?: string | null;
    customerName?: string | null;
    address?: string;
    notes?: string;
    addOns?: string[];
  }) =>
    request<{
      jobId: string;
      status: string;
      skillKey: string;
      basePrice: number;
      perKmRate: number;
      addOns: string[];
      addOnsTotal: number;
    }>('/jobs/create', { method: 'POST', body }),

  getJob: (id: string) => request<Job>(`/jobs/${id}`),

  cancelJob: (id: string) =>
    request<Job>(`/jobs/${id}/customer-cancel`, { method: 'POST' }),

  getCustomerJobs: (customerId: string) =>
    request<{ jobs: Job[] }>(`/jobs/customer?customerId=${encodeURIComponent(customerId)}`),

  getUnratedJob: (customerId: string) =>
    request<{ job: Job | null }>(`/jobs/customer/unrated?customerId=${encodeURIComponent(customerId)}`),

  skipRating: (jobId: string) =>
    request<{ ok: boolean }>(`/jobs/${jobId}/skip-rating`, { method: 'POST' }),

  uploadImage: (base64: string) =>
    request<{ url: string }>('/upload', {
      method: 'POST',
      body: { base64 },
    }),

  // ---- AI ----
  askAI: (prompt: string, imageBase64?: string, sessionId?: string, customerId?: string | null, customerName?: string) =>
    request<{ response: string; sessionId: string }>('/ai/ask', {
      method: 'POST',
      body: { prompt, image: imageBase64, sessionId, customerId, customerName },
    }),

  saveChatHistory: (sessionId: string, messages: any[], customerId?: string | null) =>
    request<{ ok: boolean }>('/ai/history', {
      method: 'POST',
      body: { sessionId, messages, customerId },
    }),

  loadChatHistory: (customerId: string, sessionId?: string) =>
    request<{ messages: any[]; sessionId: string | null }>(
      `/ai/history?customerId=${encodeURIComponent(customerId)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`
    ),

  listChatSessions: (customerId: string) =>
    request<{ sessions: { sessionId: string; updatedAt: string; preview: string }[] }>(
      `/ai/sessions?customerId=${encodeURIComponent(customerId)}`
    ),

  // ---- ratings ----
  rateWorker: (jobId: string, rating: number) =>
    request<{ ok: boolean }>(`/jobs/${jobId}/rate`, {
      method: 'POST',
      body: { rating },
    }),

  // ---- FCM ----
  sendFcmToken: (customerId: string, fcmToken: string) =>
    request<{ ok: boolean }>('/auth/customer-fcm-token', {
      method: 'POST',
      body: { customerId, fcmToken },
    }),
};
