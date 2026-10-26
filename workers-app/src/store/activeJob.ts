import { create } from 'zustand';
import type { Job } from '../services/api';

type ActiveJobState = {
  job: Job | null;
  setJob: (j: Job | null) => void;
  clear: () => void;
};

export const useActiveJob = create<ActiveJobState>((set) => ({
  job: null,
  setJob: (job) => set({ job }),
  clear: () => set({ job: null }),
}));

export const getActiveJob = () => useActiveJob.getState();

/** Statuses that mean the worker must stay locked on JobActiveScreen. */
export const ACTIVE_STATUSES = new Set([
  'accepted',
  'arrived',
  'completed',
]);

export function isActive(j: Job | null) {
  return !!(j && ACTIVE_STATUSES.has(j.status));
}
