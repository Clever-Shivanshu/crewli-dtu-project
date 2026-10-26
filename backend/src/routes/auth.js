import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { toGeoPoint } from '../geo.js';
import { LANGUAGE_CODES, PROFESSION_KEYS, ALL_SKILL_KEYS } from '../catalog.js';
import { issueTokens, rotateRefreshToken, revokeRefreshToken } from '../services/tokens.js';

export default async function authRoutes(fastify) {
  // POST /auth/request-otp { phone }
  fastify.post('/auth/request-otp', async (req, reply) => {
    const { phone } = req.body || {};
    if (!phone || typeof phone !== 'string' || phone.length < 6) {
      return reply.code(400).send({ error: 'phone_required' });
    }
    const devOtp = process.env.DEV_OTP || '1234';
    req.log.info(`[auth] OTP for ${phone} is ${devOtp} (dev stub)`);
    return { ok: true, devOtp };
  });

  // POST /auth/customer-verify-otp { phone, otp } -> { ok, phone, customerId, profile }
  // Upserts a customer document so we have a persistent ID for this user.
  fastify.post('/auth/customer-verify-otp', async (req, reply) => {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) return reply.code(400).send({ error: 'phone_and_otp_required' });
    const devOtp = process.env.DEV_OTP || '1234';
    if (otp !== devOtp) return reply.code(401).send({ error: 'invalid_otp' });

    const db = getDB();
    const now = new Date();
    const customer = await db.collection('customers').findOneAndUpdate(
      { phone },
      {
        $set: { lastActive: now },
        $setOnInsert: {
          phone,
          name: '',
          address: '',
          imageUrl: null,
          location: null,
          savedAddresses: [],
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return {
      ok: true,
      phone,
      customerId: customer._id.toString(),
      profile: {
        name: customer.name || '',
        address: customer.address || '',
        imageUrl: customer.imageUrl || null,
        location: customer.location
          ? { lat: customer.location.coordinates[1], lng: customer.location.coordinates[0] }
          : null,
        savedAddresses: customer.savedAddresses || [],
      },
    };
  });

  // POST /auth/customer-update-profile { customerId, name?, address?, location?, imageUrl?, savedAddresses? }
  fastify.post('/auth/customer-update-profile', async (req, reply) => {
    const { customerId, name, address, location, imageUrl, savedAddresses } = req.body || {};
    if (!customerId) return reply.code(400).send({ error: 'customerId_required' });

    const db = getDB();
    const setFields = { lastActive: new Date() };
    if (typeof name === 'string') setFields.name = name.trim().slice(0, 80);
    if (typeof address === 'string') setFields.address = address.trim().slice(0, 200);
    if (typeof imageUrl === 'string' || imageUrl === null) setFields.imageUrl = imageUrl;
    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
      setFields.location = { type: 'Point', coordinates: [location.lng, location.lat] };
    }
    if (Array.isArray(savedAddresses)) setFields.savedAddresses = savedAddresses;

    await db.collection('customers').updateOne(
      { _id: new ObjectId(customerId) },
      { $set: setFields }
    );
    return { ok: true };
  });

  // GET /auth/customer-profile?customerId=xxx
  fastify.get('/auth/customer-profile', async (req, reply) => {
    const { customerId } = req.query;
    if (!customerId) return reply.code(400).send({ error: 'customerId_required' });

    const db = getDB();
    const c = await db.collection('customers').findOne({ _id: new ObjectId(customerId) });
    if (!c) return reply.code(404).send({ error: 'customer_not_found' });

    return {
      customerId: c._id.toString(),
      phone: c.phone,
      name: c.name || '',
      address: c.address || '',
      imageUrl: c.imageUrl || null,
      location: c.location
        ? { lat: c.location.coordinates[1], lng: c.location.coordinates[0] }
        : null,
      savedAddresses: c.savedAddresses || [],
    };
  });

  // POST /auth/check-phone { phone } -> { exists, onboarded }
  // Used by the Welcome screen to decide login vs full onboarding.
  fastify.post('/auth/check-phone', async (req, reply) => {
    const { phone } = req.body || {};
    if (!phone || typeof phone !== 'string' || phone.length < 6) {
      return reply.code(400).send({ error: 'phone_required' });
    }
    const db = getDB();
    const w = await db.collection('workers').findOne(
      { phone },
      { projection: { language: 1, profession: 1, skills: 1, name: 1 } }
    );
    if (!w) return { exists: false, onboarded: false };
    const onboarded = !!(
      w.name &&
      w.language &&
      w.profession &&
      Array.isArray(w.skills) &&
      w.skills.length > 0
    );
    return { exists: true, onboarded };
  });

  // POST /auth/login { phone, otp, fcmToken?, location?, name? }
  fastify.post('/auth/login', async (req, reply) => {
    const { phone, otp, fcmToken, location, name } = req.body || {};
    if (!phone || !otp) return reply.code(400).send({ error: 'phone_and_otp_required' });

    const devOtp = process.env.DEV_OTP || '1234';
    if (otp !== devOtp) return reply.code(401).send({ error: 'invalid_otp' });

    const db = getDB();
    const now = new Date();
    const geo = toGeoPoint(location);

    const setOnUpdate = { phone, lastActive: now };
    if (fcmToken) setOnUpdate.fcmToken = fcmToken;
    if (geo) setOnUpdate.location = geo;
    if (typeof name === 'string' && name.trim()) setOnUpdate.name = name.trim();

    const worker = await db.collection('workers').findOneAndUpdate(
      { phone },
      {
        $set: setOnUpdate,
        $setOnInsert: {
          isAvailable: false,
          missedCount: 0,
          jobsMissedCount: 0,
          fatigueScore: 0,
          rating: 5,
          language: null,
          profession: null,
          skills: [],
          languages: [],
          imageUrl: null,
          refreshTokens: [],
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const { accessToken, refreshToken, refreshExpiresAt } = await issueTokens(fastify, worker);
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
      worker: publicWorker(worker),
    };
  });

  // POST /auth/refresh { refreshToken }
  fastify.post('/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body || {};
    const r = await rotateRefreshToken(fastify, refreshToken);
    if (!r.ok) return reply.code(401).send({ error: r.reason });
    return {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      refreshExpiresAt: r.refreshExpiresAt,
      worker: r.worker,
    };
  });

  // POST /auth/logout { refreshToken }
  fastify.post('/auth/logout', { preHandler: fastify.authenticate }, async (req) => {
    const { refreshToken } = req.body || {};
    await revokeRefreshToken(req.user.sub, refreshToken);
    return { ok: true };
  });

  // POST /auth/fcm-token { fcmToken }
  fastify.post('/auth/fcm-token', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { fcmToken } = req.body || {};
    if (!fcmToken) return reply.code(400).send({ error: 'fcmToken_required' });
    const db = getDB();
    await db.collection('workers').updateOne(
      { _id: new ObjectId(req.user.sub) },
      { $set: { fcmToken, lastActive: new Date() } }
    );
    return { ok: true };
  });

  // POST /auth/customer-fcm-token { customerId, fcmToken }
  fastify.post('/auth/customer-fcm-token', async (req, reply) => {
    const { customerId, fcmToken } = req.body || {};
    if (!customerId || !fcmToken) return reply.code(400).send({ error: 'customerId_and_fcmToken_required' });
    const db = getDB();
    await db.collection('customers').updateOne(
      { _id: new ObjectId(customerId) },
      { $set: { fcmToken, lastActive: new Date() } }
    );
    return { ok: true };
  });
}

function isOnboarded(w) {
  return !!(
    w &&
    w.name &&
    w.language &&
    LANGUAGE_CODES.includes(w.language) &&
    w.profession &&
    PROFESSION_KEYS.includes(w.profession) &&
    Array.isArray(w.skills) &&
    w.skills.length > 0 &&
    w.skills.every((s) => ALL_SKILL_KEYS.includes(s))
  );
}

export function publicWorker(w) {
  if (!w) return null;
  return {
    id: w._id.toString(),
    phone: w.phone,
    name: w.name || '',
    language: w.language || null,
    profession: w.profession || null,
    skills: w.skills || [],
    languages: w.languages || [],
    imageUrl: w.imageUrl || null,
    isAvailable: !!w.isAvailable,
    rating: typeof w.rating === 'number' ? w.rating : 5,
    fatigueScore: w.fatigueScore || 0,
    missedCount: w.missedCount || 0,
    jobsMissedCount: w.jobsMissedCount ?? w.missedCount ?? 0,
    onboarded: isOnboarded(w),
    location: w.location
      ? { lat: w.location.coordinates[1], lng: w.location.coordinates[0] }
      : null,
  };
}

/**
 * Slim worker shape safe for customer apps: no fatigue, no skills, no flags.
 * Used whenever we embed the assigned worker into a public job response.
 */
export function publicWorkerLite(w) {
  if (!w) return null;
  return {
    id: w._id.toString(),
    name: w.name || '',
    phone: w.phone || '',
    imageUrl: w.imageUrl || null,
    rating: typeof w.rating === 'number' ? w.rating : 5,
    profession: w.profession || null,
    location: w.location
      ? { lat: w.location.coordinates[1], lng: w.location.coordinates[0] }
      : null,
  };
}
