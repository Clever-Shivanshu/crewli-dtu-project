import { getDB } from '../db.js';

const DECAY_FACTOR = parseFloat(process.env.FATIGUE_DECAY_FACTOR || '0.5'); // multiply every hour
const DECAY_INTERVAL_MS = parseInt(process.env.FATIGUE_DECAY_INTERVAL_MS || `${60 * 60 * 1000}`, 10);

let handle = null;

export function startFatigueDecay() {
  if (handle) return;
  handle = setInterval(runOnce, DECAY_INTERVAL_MS);
  // Do not run immediately — first tick is +1h. This avoids wiping fatigue on every deploy.
  console.log(`[fatigue] decay scheduled every ${DECAY_INTERVAL_MS}ms factor=${DECAY_FACTOR}`);
}

export function stopFatigueDecay() {
  if (handle) clearInterval(handle);
  handle = null;
}

export async function runOnce() {
  try {
    const db = getDB();
    const res = await db.collection('workers').updateMany(
      { fatigueScore: { $gt: 0 } },
      [
        {
          $set: {
            fatigueScore: {
              $let: {
                vars: { next: { $multiply: ['$fatigueScore', DECAY_FACTOR] } },
                // Below 0.05 → clamp to 0 so the index/query stays clean.
                in: { $cond: [{ $lt: ['$$next', 0.05] }, 0, '$$next'] },
              },
            },
          },
        },
      ]
    );
    console.log(`[fatigue] decayed ${res.modifiedCount} workers`);
  } catch (e) {
    console.error('[fatigue] decay failed', e);
  }
}
