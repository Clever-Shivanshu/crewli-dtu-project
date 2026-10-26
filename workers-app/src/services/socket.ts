import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { getAuth } from '../store/auth';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  const token = getAuth().accessToken;
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinJob(jobId: string) {
  getSocket().emit('join_job', jobId);
}

export function leaveJob(jobId: string) {
  if (socket) socket.emit('leave_job', jobId);
}
