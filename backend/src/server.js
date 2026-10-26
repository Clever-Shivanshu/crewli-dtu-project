import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';

import { connectDB, closeDB } from './db.js';
import { initFCM } from './fcm.js';
import authRoutes from './routes/auth.js';
import workerRoutes from './routes/worker.js';
import jobsRoutes from './routes/jobs.js';
import catalogRoutes from './routes/catalog.js';
import aiRoutes from './routes/ai.js';
import uploadRoutes from './routes/upload.js';
import { startFatigueDecay, stopFatigueDecay } from './services/fatigue.js';
import { initSockets } from './sockets.js';
import fastifyStatic from '@fastify/static';
import path from 'path';

const app = Fastify({ logger: { level: 'info' } });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });

await app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/',
});

app.decorate('authenticate', async function (req, reply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
  }
});

app.get('/health', async () => ({ ok: true, ts: Date.now() }));
app.get('/', async () => ({ ok: true, ts: Date.now() }));

await app.register(catalogRoutes);
await app.register(authRoutes);
await app.register(workerRoutes);
await app.register(jobsRoutes);
await app.register(aiRoutes);
await app.register(uploadRoutes);
await app.register((await import('./routes/commando.js')).default);

const start = async () => {
  try {
    await connectDB();
    initFCM();
    startFatigueDecay();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    await app.listen({ port, host });
    initSockets(app.server, app);
    app.log.info(`Crewli backend listening on http://${host}:${port} (socket.io enabled)`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  stopFatigueDecay();
  await app.close();
  await closeDB();
  process.exit(0);
});

start();
