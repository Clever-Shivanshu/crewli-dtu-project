import { Server } from 'socket.io';

let io = null;

/**
 * Initialise Socket.IO on top of the Fastify HTTP server.
 *
 * Handshake:
 *   - Worker: { auth: { token } }             → verified via fastify.jwt
 *   - Customer: { auth: { role:'customer', jobId } } → auto-joins job room
 *
 * Rooms follow the pattern `job:<jobId>`. Workers explicitly call
 * `join_job` after accept; customers are auto-joined at connect time.
 */
export function initSockets(httpServer, fastify) {
  io = new Server(httpServer, { cors: { origin: true } });

  io.use((socket, next) => {
    const { token, jobId, role } = socket.handshake.auth || {};
    if (role === 'customer' && jobId) {
      socket.data.role = 'customer';
      socket.data.jobId = String(jobId);
      return next();
    }
    try {
      const decoded = fastify.jwt.verify(token);
      socket.data.role = 'worker';
      socket.data.workerId = decoded.sub;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.role === 'customer') {
      socket.join(`job:${socket.data.jobId}`);
    }

    socket.on('join_job', (jobId) => {
      if (typeof jobId === 'string' && jobId) socket.join(`job:${jobId}`);
    });
    socket.on('leave_job', (jobId) => {
      if (typeof jobId === 'string' && jobId) socket.leave(`job:${jobId}`);
    });

    // Worker pushes a live location update; relay to the job room.
    socket.on('worker_location', (payload) => {
      if (socket.data.role !== 'worker') return;
      const { jobId, lat, lng, ts } = payload || {};
      if (!jobId || typeof lat !== 'number' || typeof lng !== 'number') return;
      io.to(`job:${jobId}`).emit('worker_location', { lat, lng, ts: ts || Date.now() });
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitToJob(jobId, event, payload) {
  if (!io) return;
  io.to(`job:${jobId}`).emit(event, payload);
}
