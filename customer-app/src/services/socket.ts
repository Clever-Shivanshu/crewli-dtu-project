import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

let socket: Socket | null = null;
let currentJobId: string | null = null;

/**
 * Open (or reuse) a customer socket bound to a specific jobId. The backend
 * auto-joins the matching `job:<id>` room on handshake, so we start receiving
 * `job:update`, `job:accepted`, and `worker_location` events immediately.
 */
export function connectCustomerSocket(jobId: string): Socket {
  if (socket && currentJobId === jobId) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentJobId = jobId;
  socket = io(API_BASE_URL, {
    auth: { role: 'customer', jobId },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
  return socket;
}

export function disconnectCustomerSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentJobId = null;
  }
}

export function getCustomerSocket() {
  return socket;
}
