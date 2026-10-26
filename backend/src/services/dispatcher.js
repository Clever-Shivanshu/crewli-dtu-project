import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { sendJobPush, sendJobTakenPush, sendCustomerPush } from '../fcm.js';
import { computePrice } from '../pricing.js';
import { emitToJob } from '../sockets.js';
import { publicWorkerLite } from '../routes/auth.js';

// ── Two-phase broadcast-all dispatch ──────────────────────────────────
// Phase 0: all workers within 5 km
// Phase 1: all workers between 5–16 km (who weren't already invited)
// If nobody accepts in either phase → expire the job.
export const PHASES = [
  { min: 0,  max: 5  },
  { min: 5,  max: 16 },
];

const PHASE_TIMEOUT_MS = parseInt(process.env.PHASE_TIMEOUT_MS || '30000', 10);
const MAX_MISSED = parseInt(process.env.MAX_MISSED_BEFORE_OFFLINE || '3', 10);
const FATIGUE_INCREMENT = parseFloat(process.env.FATIGUE_INCREMENT || '1');

// In-flight failover timers so we can cancel on accept / customer-cancel.
const failoverTimers = new Map();

/**
 * Find ALL available workers in a distance band for a given job.
 * Returns [{ worker, distanceKm, score }].
 */
async function findWorkersInBand(job, minKm, maxKm) {
  if (!job.customerLocation || !Array.isArray(job.customerLocation.coordinates)) {
    console.warn(`[dispatch] job ${job._id} has no customerLocation; cannot match`);
    return [];
  }

  const excluded = [
    ...(job.broadcastedTo || []).map((id) => new ObjectId(id)),
    ...(job.rejectedBy || []).map((id) => new ObjectId(id)),
  ];

  const db = getDB();
  const docs = await db.collection('workers').aggregate([
    {
      $geoNear: {
        near: job.customerLocation,
        distanceField: 'distanceM',
        spherical: true,
        minDistance: minKm * 1000,
        maxDistance: maxKm * 1000,
        query: {
          _id: { $nin: excluded },
          isAvailable: true,
          activeJobId: { $exists: false },
          skills: job.skillKey,
          fcmToken: { $exists: true, $ne: null },
          commissionBlocked: { $ne: true }, // exclude workers with unpaid commission
        },
      },
    },
    {
      $addFields: {
        distanceKm: { $divide: ['$distanceM', 1000] },
        score: {
          $add: [
            { $multiply: [{ $divide: ['$distanceM', 1000] }, 0.7] },
            { $multiply: [{ $ifNull: ['$fatigueScore', 0] }, 0.3] },
          ],
        },
        ratingScore: { $ifNull: ['$rating', 4.5] },
      },
    },
    { $sort: { ratingScore: -1, score: 1 } },
  ]).toArray();

  return docs.map((w) => ({ worker: w, distanceKm: w.distanceKm, score: w.score }));
}

/**
 * Broadcast a job to the current phase. Sends to ALL workers in the band.
 */
export async function broadcastJob(jobId, phaseIdx = 0) {
  const db = getDB();
  const job = await db.collection('jobs').findOne({ _id: new ObjectId(jobId) });
  if (!job || job.status !== 'pending') return { done: true };

  if (phaseIdx >= PHASES.length) {
    await expireJob(jobId, 'all_phases_exhausted');
    return { expired: true };
  }

  const phase = PHASES[phaseIdx];
  const batch = await findWorkersInBand(job, phase.min, phase.max);

  if (batch.length === 0) {
    // No workers in this band — skip immediately to next phase.
    console.log(`[dispatch] job ${jobId} phase ${phaseIdx} (${phase.min}-${phase.max}km) empty — advancing`);
    return broadcastJob(jobId, phaseIdx + 1);
  }

  const workerIds = batch.map((b) => b.worker._id);

  // Record broadcast + current phase on the job.
  await db.collection('jobs').updateOne(
    { _id: new ObjectId(jobId) },
    {
      $addToSet: { broadcastedTo: { $each: workerIds } },
      $set: { currentPhase: phaseIdx, lastBroadcastAt: new Date() },
    }
  );

  // Bump fatigue for everyone we just offered.
  await db.collection('workers').updateMany(
    { _id: { $in: workerIds } },
    { $inc: { fatigueScore: FATIGUE_INCREMENT } }
  );

  const sentAt = Date.now();

  // Fire push to each worker with THEIR personalised distance + price.
  await Promise.allSettled(
    batch.map((b) => {
      const { price, basePrice, perKmRate, distanceKm } = computePrice(
        job.skillKey,
        b.distanceKm,
        job.addOns
      );
      const payload = {
        type: 'JOB_OFFER',
        jobId: jobId.toString(),
        jobType: job.jobType || job.skillKey || 'service',
        skillKey: job.skillKey || '',
        category: job.category || '',
        subProblemTitle: job.subProblemTitle || '',
        distanceKm: String(distanceKm),
        priceEstimate: String(price),
        basePrice: String(basePrice),
        perKmRate: String(perKmRate),
        address: job.address || '',
        customerLat: String(job.customerLocation.coordinates[1]),
        customerLng: String(job.customerLocation.coordinates[0]),
        expiresInMs: String(PHASE_TIMEOUT_MS),
        sentAt: String(sentAt),
        phase: String(phaseIdx),
        postCleaning: String((job.addOns || []).includes('cleaning')),
      };
      return sendJobPush(b.worker.fcmToken, payload);
    })
  );

  console.log(
    `[dispatch] job ${jobId} phase ${phaseIdx} (${phase.min}-${phase.max}km) → ${batch.length} workers ` +
      `[${batch.map((b) => `${b.worker.phone}@${b.distanceKm.toFixed(1)}km`).join(', ')}]`
  );

  scheduleFailover(jobId, workerIds, phaseIdx);
  return { phase: phaseIdx, sentTo: batch.length };
}

function scheduleFailover(jobId, workerIds, phaseIdx) {
  clearFailoverTimer(jobId);
  const t = setTimeout(
    () => handleTimeout(jobId, workerIds, phaseIdx).catch(console.error),
    PHASE_TIMEOUT_MS
  );
  failoverTimers.set(jobId.toString(), t);
}

function clearFailoverTimer(jobId) {
  const k = jobId.toString();
  const t = failoverTimers.get(k);
  if (t) {
    clearTimeout(t);
    failoverTimers.delete(k);
  }
}

async function handleTimeout(jobId, workerIds, phaseIdx) {
  const db = getDB();
  const job = await db.collection('jobs').findOne({ _id: new ObjectId(jobId) });
  if (!job || job.status !== 'pending') return;

  // Count these as missed for every worker who didn't act.
  const stillPending = workerIds.filter(
    (wid) => !(job.rejectedBy || []).some((r) => r.toString() === wid.toString())
  );
  if (stillPending.length) {
    await db.collection('workers').updateMany(
      { _id: { $in: stillPending } },
      { $inc: { missedCount: 1 } }
    );
    await db.collection('workers').updateMany(
      { _id: { $in: stillPending }, missedCount: { $gte: MAX_MISSED } },
      { $set: { isAvailable: false } }
    );
  }

  console.log(`[dispatch] job ${jobId} phase ${phaseIdx} timeout → advancing`);
  await broadcastJob(jobId, phaseIdx + 1);
}

/**
 * Atomic accept: first worker wins via findOneAndUpdate with status=pending predicate.
 * Immediately notifies all other workers to stop ringing.
 */
export async function acceptJob(jobId, workerId) {
  const db = getDB();
  const now = new Date();

  const job = await db.collection('jobs').findOneAndUpdate(
    { _id: new ObjectId(jobId), status: 'pending' },
    {
      $set: {
        status: 'accepted',
        assignedWorkerId: new ObjectId(workerId),
        acceptedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  if (!job) return { ok: false, reason: 'job_unavailable' };

  await db.collection('workers').updateOne(
    { _id: new ObjectId(workerId) },
    { $set: { missedCount: 0, lastActive: now, activeJobId: new ObjectId(jobId) } }
  );

  clearFailoverTimer(jobId);

  // Tell the customer that a worker was matched.
  try {
    const w = await db.collection('workers').findOne({ _id: new ObjectId(workerId) });
    emitToJob(jobId.toString(), 'job:accepted', {
      jobId: jobId.toString(),
      acceptedAt: now.toISOString(),
      worker: publicWorkerLite(w),
    });
  } catch (e) {
    console.error('[dispatch] socket emit failed', e);
  }

  // Notify ALL other workers who were offered this job to stop ringing.
  await dismissAllOtherWorkers(db, job, workerId.toString());

  // Send FCM push to the customer: "Worker Found!"
  if (job.customerId) {
    const customer = await db.collection('customers').findOne({ _id: job.customerId });
    if (customer?.fcmToken) {
      const w = await db.collection('workers').findOne({ _id: new ObjectId(workerId) });
      sendCustomerPush(
        customer.fcmToken,
        'Worker Found! 🎉',
        `${w?.name || 'Your worker'} is on the way to your location.`,
        { type: 'WORKER_FOUND', jobId: jobId.toString() }
      ).catch(() => {});
    }
  }

  return { ok: true, job };
}

export async function rejectJob(jobId, workerId) {
  const db = getDB();
  const job = await db.collection('jobs').findOne({ _id: new ObjectId(jobId) });
  if (!job || job.status !== 'pending') return { ok: false, reason: 'job_unavailable' };

  await db.collection('jobs').updateOne(
    { _id: new ObjectId(jobId) },
    { $addToSet: { rejectedBy: new ObjectId(workerId) } }
  );

  // If every worker in the current phase has now rejected, advance immediately.
  const fresh = await db.collection('jobs').findOne({ _id: new ObjectId(jobId) });
  if (!fresh || fresh.status !== 'pending') return { ok: true };

  const broadcastedIds = (fresh.broadcastedTo || []).map((id) => id.toString());
  const rejectedIds = new Set((fresh.rejectedBy || []).map((id) => id.toString()));
  const allRejected = broadcastedIds.length > 0 &&
    broadcastedIds.every((id) => rejectedIds.has(id));

  if (allRejected) {
    const currentPhase = fresh.currentPhase ?? 0;
    const advance = await db.collection('jobs').findOneAndUpdate(
      { _id: new ObjectId(jobId), status: 'pending', currentPhase },
      { $set: { currentPhase: currentPhase + 1 } },
      { returnDocument: 'after' }
    );
    if (advance) {
      console.log(`[dispatch] job ${jobId} phase ${currentPhase} — all workers rejected, advancing now`);
      clearFailoverTimer(jobId);
      broadcastJob(jobId, currentPhase + 1).catch(console.error);
    }
  }

  return { ok: true };
}

/**
 * Called when the customer cancels while workers are still ringing.
 * Sends JOB_TAKEN push to every worker in broadcastedTo so their phones stop.
 */
export async function cancelJobNotifyWorkers(jobId) {
  const db = getDB();
  clearFailoverTimer(jobId);

  const job = await db.collection('jobs').findOne({ _id: new ObjectId(jobId) });
  if (!job) return;

  const workerIds = (job.broadcastedTo || []).map((id) => id.toString());
  if (workerIds.length === 0) return;

  const workers = await db
    .collection('workers')
    .find({ _id: { $in: workerIds.map((id) => new ObjectId(id)) }, fcmToken: { $exists: true } })
    .toArray();

  console.log(`[dispatch] job ${jobId} cancelled by customer → dismissing ${workers.length} workers`);
  await Promise.allSettled(workers.map((w) => sendJobTakenPush(w.fcmToken, jobId.toString())));
}

/**
 * Send JOB_TAKEN to all workers who were offered the job except the one who accepted.
 */
async function dismissAllOtherWorkers(db, job, acceptedWorkerId) {
  const others = (job.broadcastedTo || [])
    .map((id) => id.toString())
    .filter((id) => id !== acceptedWorkerId);

  if (others.length === 0) return;

  const workers = await db
    .collection('workers')
    .find({ _id: { $in: others.map((id) => new ObjectId(id)) }, fcmToken: { $exists: true } })
    .toArray();

  console.log(`[dispatch] job ${job._id} accepted → dismissing ${workers.length} other workers`);
  await Promise.allSettled(workers.map((w) => sendJobTakenPush(w.fcmToken, job._id.toString())));
}

/**
 * Mark a pending job expired AND tell everyone listening on the job room.
 */
async function expireJob(jobId, reason) {
  const db = getDB();
  const updated = await db.collection('jobs').findOneAndUpdate(
    { _id: new ObjectId(jobId), status: 'pending' },
    { $set: { status: 'expired', expiredAt: new Date() } },
    { returnDocument: 'after' }
  );
  clearFailoverTimer(jobId);
  console.log(`[dispatch] job ${jobId} expired — ${reason}`);

  if (updated) {
    emitToJob(jobId.toString(), 'job:update', {
      id: updated._id.toString(),
      skillKey: updated.skillKey,
      category: updated.category,
      jobType: updated.jobType,
      subProblemTitle: updated.subProblemTitle || null,
      address: updated.address || '',
      notes: updated.notes || '',
      status: 'expired',
      basePrice: updated.basePrice,
      perKmRate: updated.perKmRate,
      addOns: updated.addOns || [],
      addOnsTotal: updated.addOnsTotal || 0,
      finalPrice: null,
      customerPhone: updated.customerPhone || null,
      customerLocation: updated.customerLocation
        ? {
            lat: updated.customerLocation.coordinates[1],
            lng: updated.customerLocation.coordinates[0],
          }
        : null,
      createdAt: updated.createdAt,
      acceptedAt: null,
      arrivedAt: null,
      completedAt: null,
      paidAt: null,
      cancelledAt: null,
      cancelledBy: null,
      worker: null,
    });
  }
}
