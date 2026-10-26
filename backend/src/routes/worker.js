import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { toGeoPoint } from '../geo.js';
import { publicWorker } from './auth.js';
import { ALL_SKILL_KEYS, LANGUAGE_CODES, PROFESSION_KEYS, PROFESSIONS } from '../catalog.js';
import { makeUploadSignature } from '../cloudinary.js';
import { emitToJob } from '../sockets.js';

export default async function workerRoutes(fastify) {
  // POST /worker/toggle { isAvailable, location?: {lat,lng} }
  fastify.post('/worker/toggle', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { isAvailable, location } = req.body || {};
    if (typeof isAvailable !== 'boolean') {
      return reply.code(400).send({ error: 'isAvailable_boolean_required' });
    }
    const set = {
      isAvailable,
      lastActive: new Date(),
      ...(isAvailable ? { missedCount: 0, jobsMissedCount: 0 } : {}),
    };
    const geo = toGeoPoint(location);
    if (geo) set.location = geo;

    const db = getDB();
    await db.collection('workers').updateOne(
      { _id: new ObjectId(req.user.sub) },
      { $set: set }
    );
    return { ok: true, isAvailable };
  });

  // GET /worker/me
  fastify.get('/worker/me', { preHandler: fastify.authenticate }, async (req, reply) => {
    const db = getDB();
    const w = await db.collection('workers').findOne({ _id: new ObjectId(req.user.sub) });
    if (!w) return reply.code(404).send({ error: 'not_found' });
    return publicWorker(w);
  });

  // GET /worker/stats
  // Dashboard headline numbers for the worker: total completed jobs + a
  // rolling earnings window (today / this week / this month). We count
  // anything that reached 'completed' or 'paid' so a still-open job the
  // worker finished but hasn't marked paid yet still shows up.
  fastify.get('/worker/stats', { preHandler: fastify.authenticate }, async (req) => {
    const db = getDB();
    const workerId = new ObjectId(req.user.sub);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    // Make weeks start on Monday (locale-safe enough for MVP).
    const dow = (startOfToday.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - dow);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pipeline = [
      {
        $match: {
          assignedWorkerId: workerId,
          status: { $in: ['completed', 'paid'] },
        },
      },
      {
        $group: {
          _id: null,
          totalCompleted: { $sum: 1 },
          earningsToday: {
            $sum: {
              $cond: [
                { $gte: [{ $ifNull: ['$completedAt', '$paidAt'] }, startOfToday] },
                { $ifNull: ['$finalPrice', 0] },
                0,
              ],
            },
          },
          earningsWeek: {
            $sum: {
              $cond: [
                { $gte: [{ $ifNull: ['$completedAt', '$paidAt'] }, startOfWeek] },
                { $ifNull: ['$finalPrice', 0] },
                0,
              ],
            },
          },
          earningsMonth: {
            $sum: {
              $cond: [
                { $gte: [{ $ifNull: ['$completedAt', '$paidAt'] }, startOfMonth] },
                { $ifNull: ['$finalPrice', 0] },
                0,
              ],
            },
          },
          earningsAll: { $sum: { $ifNull: ['$finalPrice', 0] } },
          jobsToday: {
            $sum: {
              $cond: [
                { $gte: [{ $ifNull: ['$completedAt', '$paidAt'] }, startOfToday] },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const [row] = await db.collection('jobs').aggregate(pipeline).toArray();
    return {
      totalCompleted: row?.totalCompleted || 0,
      jobsToday: row?.jobsToday || 0,
      earningsToday: row?.earningsToday || 0,
      earningsWeek: row?.earningsWeek || 0,
      earningsMonth: row?.earningsMonth || 0,
      earningsAll: row?.earningsAll || 0,
    };
  });

  // POST /worker/location { lat, lng, jobId? }
  // High-frequency endpoint the worker app hits whenever the worker has moved
  // ≥250 m. Updates worker.location AND (if jobId present and the worker is
  // assigned to it) broadcasts to the job room so the customer sees movement.
  fastify.post('/worker/location', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { lat, lng, jobId } = req.body || {};
    const geo = toGeoPoint({ lat, lng });
    if (!geo) return reply.code(400).send({ error: 'bad_location' });

    const db = getDB();
    await db.collection('workers').updateOne(
      { _id: new ObjectId(req.user.sub) },
      { $set: { location: geo, lastActive: new Date() } }
    );

    if (jobId) {
      emitToJob(String(jobId), 'worker_location', {
        lat: geo.coordinates[1],
        lng: geo.coordinates[0],
        ts: Date.now(),
      });
    }
    return { ok: true };
  });

  // POST /worker/heartbeat { location? }
  fastify.post('/worker/heartbeat', { preHandler: fastify.authenticate }, async (req) => {
    const db = getDB();
    const set = { lastActive: new Date() };
    const geo = toGeoPoint(req.body?.location);
    if (geo) set.location = geo;
    const w = await db.collection('workers').findOneAndUpdate(
      { _id: new ObjectId(req.user.sub) },
      { $set: set },
      { returnDocument: 'after' }
    );
    return { ok: true, isAvailable: !!(w && w.isAvailable) };
  });

  // GET /worker/profile
  fastify.get('/worker/profile', { preHandler: fastify.authenticate }, async (req, reply) => {
    const db = getDB();
    const w = await db.collection('workers').findOne({ _id: new ObjectId(req.user.sub) });
    if (!w) return reply.code(404).send({ error: 'not_found' });
    return publicWorker(w);
  });

  // PATCH /worker/profile { name?, language?, profession?, skills?, imageUrl?, location? }
  fastify.patch('/worker/profile', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { name, language, profession, skills, imageUrl, location } = req.body || {};
    const set = { lastActive: new Date() };

    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (!trimmed) return reply.code(400).send({ error: 'name_empty' });
      if (trimmed.length > 80) return reply.code(400).send({ error: 'name_too_long' });
      set.name = trimmed;
    }

    if (language !== undefined) {
      if (!LANGUAGE_CODES.includes(language)) {
        return reply.code(400).send({ error: 'invalid_language' });
      }
      set.language = language;
    }

    if (profession !== undefined) {
      if (!PROFESSION_KEYS.includes(profession)) {
        return reply.code(400).send({ error: 'invalid_profession' });
      }
      set.profession = profession;
    }

    if (Array.isArray(skills)) {
      const invalid = skills.filter((s) => !ALL_SKILL_KEYS.includes(s));
      if (invalid.length) return reply.code(400).send({ error: 'invalid_skills', invalid });
      // If profession is being set in this request OR already set, enforce that all skills belong to it.
      const profKey = set.profession ?? (await getCurrentProfession(req.user.sub));
      if (profKey) {
        const allowed = new Set(PROFESSIONS[profKey].skillKeys);
        const outside = skills.filter((s) => !allowed.has(s));
        if (outside.length) return reply.code(400).send({ error: 'skills_outside_profession', outside });
      }
      set.skills = [...new Set(skills)];
    }

    if (typeof imageUrl === 'string') {
      if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
        return reply.code(400).send({ error: 'imageUrl_must_be_http_url' });
      }
      set.imageUrl = imageUrl || null;
    }

    const geo = toGeoPoint(location);
    if (geo) set.location = geo;

    const db = getDB();
    const w = await db.collection('workers').findOneAndUpdate(
      { _id: new ObjectId(req.user.sub) },
      { $set: set },
      { returnDocument: 'after' }
    );
    if (!w) return reply.code(404).send({ error: 'not_found' });
    return publicWorker(w);
  });

  // POST /worker/onboard { language, profession, skills, name?, location? }
  // Atomic onboarding completion — sets all required fields in one shot.
  fastify.post('/worker/onboard', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { language, profession, skills, name, location } = req.body || {};

    if (!LANGUAGE_CODES.includes(language)) {
      return reply.code(400).send({ error: 'invalid_language' });
    }
    if (!PROFESSION_KEYS.includes(profession)) {
      return reply.code(400).send({ error: 'invalid_profession' });
    }
    if (!Array.isArray(skills) || skills.length === 0) {
      return reply.code(400).send({ error: 'skills_required' });
    }
    const allowed = new Set(PROFESSIONS[profession].skillKeys);
    const outside = skills.filter((s) => !allowed.has(s));
    if (outside.length) return reply.code(400).send({ error: 'skills_outside_profession', outside });
    const invalid = skills.filter((s) => !ALL_SKILL_KEYS.includes(s));
    if (invalid.length) return reply.code(400).send({ error: 'invalid_skills', invalid });

    const set = {
      language,
      profession,
      skills: [...new Set(skills)],
      lastActive: new Date(),
    };
    if (typeof name === 'string' && name.trim()) set.name = name.trim();
    const geo = toGeoPoint(location);
    if (geo) set.location = geo;

    const db = getDB();
    const w = await db.collection('workers').findOneAndUpdate(
      { _id: new ObjectId(req.user.sub) },
      { $set: set },
      { returnDocument: 'after' }
    );
    if (!w) return reply.code(404).send({ error: 'not_found' });
    return publicWorker(w);
  });

  // POST /worker/upload-signature — signed Cloudinary params.
  fastify.post('/worker/upload-signature', { preHandler: fastify.authenticate }, async (req, reply) => {
    try {
      return makeUploadSignature({
        folder: 'crewli/workers',
        publicId: `worker_${req.user.sub}`,
      });
    } catch (e) {
      if (e.statusCode === 503) return reply.code(503).send({ error: 'cloudinary_not_configured' });
      throw e;
    }
  });

  // GET /worker/commission — current commission status for the dashboard.
  fastify.get('/worker/commission', { preHandler: fastify.authenticate }, async (req) => {
    const db = getDB();
    const workerId = new ObjectId(req.user.sub);
    const worker = await db.collection('workers').findOne({ _id: workerId });
    if (!worker) return { balance: 0, limit: 500, prepaidCredit: 0, isBlocked: false, completedJobs: 0, currentRate: 5 };

    const completedJobs = await db.collection('jobs').countDocuments({
      assignedWorkerId: workerId,
      status: 'paid',
    });

    // Determine commission rate.
    let currentRate;
    if (completedJobs < 4) {
      currentRate = 0;
    } else if (completedJobs < 10) {
      currentRate = 8;
    } else if ((worker.rating || 0) >= 4.0) {
      currentRate = 5;
    } else {
      currentRate = 7;
    }

    const prepaidCredit = worker.commissionPrepaid || 0;
    const limit = 500 + prepaidCredit;

    return {
      balance: Math.round((worker.commissionBalance || 0) * 100) / 100,
      limit,
      prepaidCredit,
      isBlocked: worker.commissionBlocked === true,
      completedJobs,
      currentRate,
    };
  });

  // POST /worker/commission/pay { amount }
  // Deducts commission balance. Any excess paid above the balance becomes
  // prepaid credit that raises the effective limit. e.g. paying ₹900 on a
  // ₹500 balance → balance zeroed, ₹400 added to prepaid, limit = 500 + prepaid.
  fastify.post('/worker/commission/pay', { preHandler: fastify.authenticate }, async (req, reply) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return reply.code(400).send({ error: 'amount must be a positive number' });
    }

    const db = getDB();
    const workerId = new ObjectId(req.user.sub);
    const worker = await db.collection('workers').findOne({ _id: workerId });
    if (!worker) return reply.code(404).send({ error: 'not_found' });

    const prevBalance = worker.commissionBalance || 0;
    const prevPrepaid = worker.commissionPrepaid || 0;

    let newBalance;
    let newPrepaid = prevPrepaid;
    let excessCredit = 0;

    if (amount > prevBalance) {
      // Any excess above the balance becomes prepaid credit
      excessCredit = Math.round((amount - prevBalance) * 100) / 100;
      newBalance = 0;
      newPrepaid = prevPrepaid + excessCredit;
    } else {
      newBalance = Math.max(0, prevBalance - amount);
    }

    const effectiveLimit = 500 + newPrepaid;
    const isStillBlocked = newBalance >= effectiveLimit;

    await db.collection('workers').updateOne(
      { _id: workerId },
      {
        $set: {
          commissionBalance: Math.round(newBalance * 100) / 100,
          commissionPrepaid: Math.round(newPrepaid * 100) / 100,
          commissionBlocked: isStillBlocked,
        },
      }
    );

    console.log(
      `[commission] worker ${workerId} paid ₹${amount} ` +
      `prevBalance=₹${prevBalance} newBalance=₹${newBalance} prepaid=₹${newPrepaid} excess=₹${excessCredit}`
    );

    return {
      ok: true,
      newBalance: Math.round(newBalance * 100) / 100,
      prepaidCredit: Math.round(newPrepaid * 100) / 100,
      limit: effectiveLimit,
      isBlocked: isStillBlocked,
      bonusCreditAdded: excessCredit,
    };
  });
}


async function getCurrentProfession(workerId) {
  const db = getDB();
  const w = await db.collection('workers').findOne(
    { _id: new ObjectId(workerId) },
    { projection: { profession: 1 } }
  );
  return w?.profession || null;
}
