import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { sendCustomerPush } from '../fcm.js';
import { broadcastJob } from '../services/dispatcher.js';

export default async function commandoRoutes(fastify) {
  // POST /commando/register - simple setup (in production, secure this)
  fastify.post('/commando/register', async (req, reply) => {
    const { username, password } = req.body || {};
    if (!username || !password) return reply.code(400).send({ error: 'username and password required' });
    
    const db = getDB();
    const existing = await db.collection('commando_users').findOne({ username });
    if (existing) return reply.code(409).send({ error: 'username_taken' });

    await db.collection('commando_users').insertOne({
      username,
      password, // Note: In production use bcrypt
      createdAt: new Date()
    });

    return { ok: true };
  });

  // POST /commando/login
  fastify.post('/commando/login', async (req, reply) => {
    const { username, password } = req.body || {};
    if (!username || !password) return reply.code(400).send({ error: 'missing_credentials' });

    const db = getDB();
    const user = await db.collection('commando_users').findOne({ username, password });
    if (!user) return reply.code(401).send({ error: 'invalid_credentials' });

    const token = fastify.jwt.sign({ sub: user._id.toString(), role: 'commando' });
    return { token };
  });

  // POST /commando/notify - Send marketing/custom FCM notifications
  fastify.post('/commando/notify', { preHandler: fastify.authenticate }, async (req, reply) => {
    if (req.user.role !== 'commando') return reply.code(403).send({ error: 'forbidden' });

    const { target, title, body, data } = req.body || {};
    // target can be 'all_customers', 'all_workers', or specific id/phone
    if (!target || !title || !body) return reply.code(400).send({ error: 'target, title, and body required' });

    const db = getDB();
    let count = 0;

    if (target === 'all_customers') {
      const customers = await db.collection('customers').find({ fcmToken: { $exists: true } }).toArray();
      for (const cust of customers) {
        if (cust.fcmToken) {
          sendCustomerPush(cust.fcmToken, title, body, data || {}).catch(() => {});
          count++;
        }
      }
    } else if (target === 'all_workers') {
      // You can implement worker custom pushes if needed using standard fcm.js methods
      // For now, this is just for customers as requested. Or we can add sendWorkerPush.
    }

    return { ok: true, sentCount: count };
  });
}
