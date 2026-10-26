import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { broadcastJob, rejectJob, acceptJob, cancelJobNotifyWorkers } from '../services/dispatcher.js';
import { toGeoPoint } from '../geo.js';
import { getSubProblem, getSkill, addOnsTotal, ADD_ON_IDS } from '../catalog.js';
import { publicWorkerLite } from './auth.js';
import { emitToJob } from '../sockets.js';
import { computePrice } from '../pricing.js';
import { sendCommissionPush } from '../fcm.js';

function toPublicJob(j, worker) {
  return {
    id: j._id.toString(),
    skillKey: j.skillKey,
    category: j.category,
    jobType: j.jobType,
    subProblemTitle: j.subProblemTitle || null,
    address: j.address || '',
    notes: j.notes || '',
    status: j.status,
    basePrice: j.basePrice,
    perKmRate: j.perKmRate,
    addOns: j.addOns || [],
    addOnsTotal: j.addOnsTotal || 0,
    finalPrice: typeof j.finalPrice === 'number' ? j.finalPrice : null,
    customerPhone: j.customerPhone || null,
    customerName: j.customerName || null,
    customerLocation: j.customerLocation
      ? { lat: j.customerLocation.coordinates[1], lng: j.customerLocation.coordinates[0] }
      : null,
    otp: j.otp || null,
    otpVerified: j.otpVerified === true,
    otpVerifiedAt: j.otpVerifiedAt || null,
    overtimeCharge: typeof j.overtimeCharge === 'number' ? j.overtimeCharge : 0,
    createdAt: j.createdAt,
    acceptedAt: j.acceptedAt || null,
    arrivedAt: j.arrivedAt || null,
    completedAt: j.completedAt || null,
    paidAt: j.paidAt || null,
    cancelledAt: j.cancelledAt || null,
    cancelledBy: j.cancelledBy || null,
    worker: worker ? publicWorkerLite(worker) : null,
  };
}

async function loadAssignedWorker(db, job) {
  if (!job || !job.assignedWorkerId) return null;
  return db.collection('workers').findOne({ _id: job.assignedWorkerId });
}

async function emitJobUpdate(jobId, job, worker) {
  emitToJob(jobId.toString(), 'job:update', toPublicJob(job, worker));
}

export default async function jobsRoutes(fastify) {
  // POST /jobs/create
  fastify.post('/jobs/create', async (req, reply) => {
    const body = req.body || {};
    let skillKey = body.skillKey;
    let subProblem = null;
    if (!skillKey && body.subProblemId) {
      subProblem = getSubProblem(body.subProblemId);
      skillKey = subProblem?.skillKey;
    } else if (body.subProblemId) {
      subProblem = getSubProblem(body.subProblemId);
    }
    if (!skillKey) return reply.code(400).send({ error: 'skillKey_or_subProblemId_required' });

    const skill = getSkill(skillKey);
    if (!skill) return reply.code(400).send({ error: 'unknown_skillKey' });

    const customerLocation = toGeoPoint(body.customerLocation);
    if (!customerLocation) return reply.code(400).send({ error: 'customerLocation_required' });

    const addOns = Array.isArray(body.addOns)
      ? body.addOns.filter((id) => ADD_ON_IDS.includes(id))
      : [];
    const addOnSum = addOnsTotal(addOns);

    const db = getDB();
    const now = new Date();

    // Look up customer from DB if customerId provided
    let customerPhone = null;
    let customerName = null;
    let customerId = null;
    let address = body.address || '';

    if (body.customerId) {
      const cust = await db.collection('customers').findOne({ _id: new ObjectId(body.customerId) });
      if (cust) {
        customerId = cust._id;
        customerPhone = cust.phone;
        customerName = cust.name || null;
        if (!address && cust.address) address = cust.address;
      }
    } else {
      // Fallback for backwards compat
      customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone : null;
      customerName = typeof body.customerName === 'string' && body.customerName.trim()
        ? body.customerName.trim().slice(0, 80) : null;
    }

    const ins = await db.collection('jobs').insertOne({
      skillKey,
      category: skill.category,
      subProblemId: body.subProblemId || null,
      subProblemTitle: subProblem?.title || null,
      jobType: skill.label,
      customerLocation,
      customerId: customerId || null,
      customerPhone,
      customerName,
      address,
      notes: body.notes || '',
      basePrice: skill.basePrice,
      perKmRate: skill.perKmRate,
      addOns,
      addOnsTotal: addOnSum,
      status: 'pending',
      assignedWorkerId: null,
      broadcastedTo: [],
      rejectedBy: [],
      currentPhase: null,
      createdAt: now,
    });

    const jobId = ins.insertedId.toString();
    broadcastJob(jobId, 0).catch(console.error);

    return {
      jobId,
      status: 'pending',
      skillKey,
      basePrice: skill.basePrice,
      perKmRate: skill.perKmRate,
      addOns,
      addOnsTotal: addOnSum,
    };
  });

  // POST /jobs/reject  { jobId }
  fastify.post('/jobs/reject', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { jobId } = req.body || {};
    if (!jobId) return reply.code(400).send({ error: 'jobId required' });
    const result = await rejectJob(jobId, req.user.sub);
    if (!result.ok) return reply.code(409).send({ error: result.reason });
    return { ok: true };
  });

  // GET /jobs/mine — jobs assigned to this worker (incl active + past).
  fastify.get('/jobs/mine', { preHandler: fastify.authenticate }, async (req) => {
    const db = getDB();
    const workerId = new ObjectId(req.user.sub);
    const jobs = await db
      .collection('jobs')
      .find({ assignedWorkerId: workerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return { jobs: jobs.map((j) => toPublicJob(j, null)) };
  });

  // GET /jobs/customer?customerId=... (fallback: phone=...)
  fastify.get('/jobs/customer', async (req, reply) => {
    const { customerId, phone } = req.query;
    if (!customerId && !phone) return reply.code(400).send({ error: 'customerId or phone required' });

    const db = getDB();
    const query = customerId
      ? { customerId: new ObjectId(customerId) }
      : { customerPhone: phone };
    const jobs = await db
      .collection('jobs')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return { jobs: jobs.map((j) => toPublicJob(j, null)) };
  });

  // GET /jobs/customer/unrated?customerId=... (fallback: phone=...)
  fastify.get('/jobs/customer/unrated', async (req, reply) => {
    const { customerId, phone } = req.query;
    if (!customerId && !phone) return reply.code(400).send({ error: 'customerId or phone required' });

    const db = getDB();
    const query = customerId
      ? { customerId: new ObjectId(customerId) }
      : { customerPhone: phone };
    const job = await db.collection('jobs').findOne(
      { 
        ...query, 
        status: 'paid',
        customerRating: { $exists: false },
        ratingSkipped: { $ne: true }
      },
      { sort: { paidAt: -1 } }
    );
    
    if (!job) return { job: null };
    
    const worker = await loadAssignedWorker(db, job);
    return { job: toPublicJob(job, worker) };
  });

  // GET /jobs/:id — public status lookup used by customer app + worker job screen.
  fastify.get('/jobs/:id', async (req, reply) => {
    const db = getDB();
    let oid;
    try { oid = new ObjectId(req.params.id); }
    catch { return reply.code(400).send({ error: 'bad id' }); }
    const j = await db.collection('jobs').findOne({ _id: oid });
    if (!j) return reply.code(404).send({ error: 'not found' });
    const worker = await loadAssignedWorker(db, j);
    return toPublicJob(j, worker);
  });

  // --- Lifecycle transitions ---

  // POST /jobs/:id/arrived — worker swiped "I have reached".
  // Generates a 4-digit OTP the customer must share with the worker.
  fastify.post('/jobs/:id/arrived', { preHandler: fastify.authenticate }, async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    // Generate a 4-digit OTP
    const otp = String(Math.floor(1000 + Math.random() * 9000));

    const job = await db.collection('jobs').findOneAndUpdate(
      {
        _id: oid,
        assignedWorkerId: new ObjectId(req.user.sub),
        status: { $in: ['accepted'] },
      },
      { $set: { status: 'arrived', arrivedAt: new Date(), otp, otpVerified: false } },
      { returnDocument: 'after' }
    );
    if (!job) return reply.code(409).send({ error: 'invalid_state' });
    const worker = await loadAssignedWorker(db, job);
    const dto = toPublicJob(job, worker);
    emitToJob(oid.toString(), 'job:update', dto);
    return dto;
  });

  // POST /jobs/:id/verify-otp — worker enters OTP from customer's phone.
  fastify.post('/jobs/:id/verify-otp', { preHandler: fastify.authenticate }, async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    const { otp } = req.body || {};
    if (!otp || typeof otp !== 'string') return reply.code(400).send({ error: 'otp_required' });

    const cur = await db.collection('jobs').findOne({
      _id: oid,
      assignedWorkerId: new ObjectId(req.user.sub),
      status: 'arrived',
    });
    if (!cur) return reply.code(409).send({ error: 'invalid_state' });
    if (cur.otpVerified) return reply.code(409).send({ error: 'otp_already_verified' });
    if (cur.otp !== otp.trim()) return reply.code(400).send({ error: 'invalid_otp' });

    const job = await db.collection('jobs').findOneAndUpdate(
      { _id: oid, status: 'arrived' },
      { $set: { otpVerified: true, otpVerifiedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!job) return reply.code(409).send({ error: 'invalid_state' });
    const worker = await loadAssignedWorker(db, job);
    const dto = toPublicJob(job, worker);
    emitToJob(oid.toString(), 'job:update', dto);
    return dto;
  });

  // POST /jobs/:id/complete — worker pressed "Work Completed".
  // Calculates overtime: free for first 30 min, then ₹7 per 8 min.
  fastify.post('/jobs/:id/complete', { preHandler: fastify.authenticate }, async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    const cur = await db.collection('jobs').findOne({
      _id: oid,
      assignedWorkerId: new ObjectId(req.user.sub),
      status: 'arrived',
    });
    if (!cur) return reply.code(409).send({ error: 'invalid_state' });

    // OTP must be verified before completing
    if (!cur.otpVerified) return reply.code(409).send({ error: 'otp_not_verified' });

    // Compute final price from the worker's current distance to the customer,
    // or accept a client-provided override.
    let finalPrice = Number(req.body?.finalPrice);
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      const me = await db.collection('workers').findOne({ _id: new ObjectId(req.user.sub) });
      let distKm = 0;
      if (me?.location && cur.customerLocation) {
        distKm = haversineKm(
          me.location.coordinates[1], me.location.coordinates[0],
          cur.customerLocation.coordinates[1], cur.customerLocation.coordinates[0]
        );
      }
      finalPrice = computePrice(cur.skillKey, distKm, cur.addOns).price;
    }

    finalPrice = Math.round(finalPrice);

    const job = await db.collection('jobs').findOneAndUpdate(
      { _id: oid, status: 'arrived' },
      { $set: { status: 'completed', completedAt: new Date(), finalPrice, overtimeCharge: 0 } },
      { returnDocument: 'after' }
    );
    if (!job) return reply.code(409).send({ error: 'invalid_state' });
    await db.collection('workers').updateOne(
      { _id: new ObjectId(req.user.sub) },
      { $unset: { activeJobId: '' } }
    );
    const worker = await loadAssignedWorker(db, job);
    const dto = toPublicJob(job, worker);
    emitToJob(oid.toString(), 'job:update', dto);
    return dto;
  });

  // POST /jobs/:id/payment-received — worker confirmed cash received.
  fastify.post('/jobs/:id/payment-received', { preHandler: fastify.authenticate }, async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    const job = await db.collection('jobs').findOneAndUpdate(
      {
        _id: oid,
        assignedWorkerId: new ObjectId(req.user.sub),
        status: 'completed',
      },
      { $set: { status: 'paid', paidAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!job) return reply.code(409).send({ error: 'invalid_state' });

    const workerId = new ObjectId(req.user.sub);
    await db.collection('workers').updateOne(
      { _id: workerId },
      { $unset: { activeJobId: '' } }
    );

    // ── Commission calculation ─────────────────────────────────────────────
    // Run asynchronously so it never blocks the payment-received response.
    calculateAndChargeCommission(db, workerId, job).catch(console.error);

    const worker = await loadAssignedWorker(db, job);
    const dto = toPublicJob(job, worker);
    emitToJob(oid.toString(), 'job:update', dto);
    return dto;
  });

  // POST /jobs/:id/cancel — worker aborts an accepted/arrived job.
  fastify.post('/jobs/:id/cancel', { preHandler: fastify.authenticate }, async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    const job = await db.collection('jobs').findOneAndUpdate(
      {
        _id: oid,
        assignedWorkerId: new ObjectId(req.user.sub),
        status: { $in: ['accepted', 'arrived'] },
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'worker',
        },
      },
      { returnDocument: 'after' }
    );
    if (!job) return reply.code(409).send({ error: 'invalid_state' });
    await db.collection('workers').updateOne(
      { _id: new ObjectId(req.user.sub) },
      { $unset: { activeJobId: '' } }
    );
    const worker = await loadAssignedWorker(db, job);
    const dto = toPublicJob(job, worker);
    emitToJob(oid.toString(), 'job:update', dto);
    return dto;
  });

  // POST /jobs/:id/customer-cancel — no auth; customer app aborts while still
  // pending or just-accepted. MVP trusts the caller.
  fastify.post('/jobs/:id/customer-cancel', async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    const job = await db.collection('jobs').findOneAndUpdate(
      { _id: oid, status: { $in: ['pending', 'accepted'] } },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'customer',
        },
      },
      { returnDocument: 'after' }
    );
    if (!job) return reply.code(409).send({ error: 'invalid_state' });

    // Immediately stop ringing on all workers who were offered this job
    cancelJobNotifyWorkers(req.params.id).catch(console.error);

    if (job.assignedWorkerId) {
      await db.collection('workers').updateOne(
        { _id: job.assignedWorkerId },
        { $unset: { activeJobId: '' } }
      );
    }
    const worker = await loadAssignedWorker(db, job);
    const dto = toPublicJob(job, worker);
    emitToJob(oid.toString(), 'job:update', dto);
    return dto;
  });

  // GET /jobs/nearby - for workers to see available jobs
  fastify.get('/jobs/nearby', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const worker = req.user;
    const db = getDB();
    
    const jobs = await db.collection('jobs')
      .find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    
    return { jobs: jobs.map(j => toPublicJob(j, null)) };
  });

  // POST /jobs/accept - worker accepts a job
  fastify.post('/jobs/accept', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { jobId } = req.body || {};
    if (!jobId) return reply.code(400).send({ error: 'jobId required' });

    const workerId = req.user.sub;
    if (!workerId) return reply.code(401).send({ error: 'unauthorized' });

    const result = await acceptJob(jobId, workerId);
    if (!result.ok) {
      return reply.code(409).send({ error: result.reason || 'job not available' });
    }

    const db = getDB();
    const worker = await db.collection('workers').findOne({ _id: new ObjectId(workerId) });
    const dto = toPublicJob(result.job, worker);
    return { job: dto };
  });

  // POST /jobs/:id/rate — customer rates the worker after payment
  fastify.post('/jobs/:id/rate', async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    const { rating } = req.body || {};
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return reply.code(400).send({ error: 'rating must be 1-5' });
    }

    const job = await db.collection('jobs').findOne({ _id: oid, status: 'paid' });
    if (!job) return reply.code(409).send({ error: 'job not paid or not found' });

    // Save rating on the job
    await db.collection('jobs').updateOne(
      { _id: oid },
      { $set: { customerRating: r, ratedAt: new Date() } }
    );

    // Update worker's average rating
    if (job.assignedWorkerId) {
      const workerId = job.assignedWorkerId;
      const worker = await db.collection('workers').findOne({ _id: workerId });
      if (worker) {
        const prevRating = worker.rating || 4.5;
        const ratingCount = worker.ratingCount || 1;
        const newRating = ((prevRating * ratingCount) + r) / (ratingCount + 1);
        await db.collection('workers').updateOne(
          { _id: workerId },
          { $set: { rating: Math.round(newRating * 10) / 10, ratingCount: ratingCount + 1 } }
        );
      }
    }

    return { ok: true };
  });

  // POST /jobs/:id/skip-rating — customer skips rating for a job
  fastify.post('/jobs/:id/skip-rating', async (req, reply) => {
    const db = getDB();
    const oid = safeOid(req.params.id);
    if (!oid) return reply.code(400).send({ error: 'bad_id' });

    await db.collection('jobs').updateOne(
      { _id: oid },
      { $set: { ratingSkipped: true } }
    );

    return { ok: true };
  });
}


function safeOid(raw) {
  try { return new ObjectId(raw); } catch { return null; }
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Calculate commission charge after a job is paid and update the worker's
 * commission balance. Sends FCM warning/block notifications as thresholds are
 * crossed.
 *
 * Tiers:
 *   - Jobs 1-4   : 0% (trial)
 *   - Jobs 5-10  : 8%
 *   - Jobs 11+   : 5% if rating >= 4.0, else 7%
 *
 * Limits:
 *   - Warning  : ₹400
 *   - Block    : ₹500 + commissionPrepaid (prepaid credit raises the limit)
 */
async function calculateAndChargeCommission(db, workerId, job) {
  const finalPrice = job.finalPrice;
  if (!finalPrice || finalPrice <= 0) return;

  // Count how many paid jobs this worker had BEFORE this one.
  const completedBefore = await db.collection('jobs').countDocuments({
    assignedWorkerId: workerId,
    status: 'paid',
    _id: { $ne: job._id },
  });

  const worker = await db.collection('workers').findOne({ _id: workerId });
  if (!worker) return;

  // Determine commission rate.
  let rate;
  if (completedBefore < 4) {
    rate = 0.0; // 0% for first 4 jobs
  } else if (completedBefore < 10) {
    rate = 0.08; // 8% for jobs 5-10
  } else if ((worker.rating || 0) >= 4.0) {
    rate = 0.05; // 5% if rating >= 4
  } else {
    rate = 0.07; // 7% otherwise
  }

  const charge = Math.round(finalPrice * rate * 100) / 100;
  const prevBalance = worker.commissionBalance || 0;
  const newBalance = prevBalance + charge;
  const prepaid = worker.commissionPrepaid || 0;
  const effectiveLimit = 500 + prepaid;

  const isNowBlocked = newBalance >= effectiveLimit;

  await db.collection('workers').updateOne(
    { _id: workerId },
    {
      $set: {
        commissionBalance: newBalance,
        commissionBlocked: isNowBlocked,
      },
    }
  );

  console.log(
    `[commission] worker ${workerId} job ${job._id} finalPrice=₹${finalPrice} ` +
    `rate=${(rate * 100).toFixed(0)}% charge=₹${charge} balance=₹${newBalance}/${effectiveLimit}`
  );

  // Send FCM push notifications (non-blocking).
  const token = worker.fcmToken;
  if (!token) return;

  if (isNowBlocked) {
    await sendCommissionPush(token, 'COMMISSION_BLOCKED', newBalance, effectiveLimit).catch(() => {});
  }
}

