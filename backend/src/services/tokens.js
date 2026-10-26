import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { publicWorker } from '../routes/auth.js';

const ACCESS_TTL = '24h';
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Issue a fresh access + refresh token pair for this worker.
 * Also persists the refresh token so we can rotate / revoke later.
 */
export async function issueTokens(fastify, worker) {
  const accessToken = fastify.jwt.sign(
    { sub: worker._id.toString(), phone: worker.phone, typ: 'access' },
    { expiresIn: ACCESS_TTL }
  );

  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const now = new Date();

  const db = getDB();
  await db.collection('workers').updateOne(
    { _id: worker._id },
    {
      $push: {
        refreshTokens: { token: refreshToken, createdAt: now, lastUsedAt: now },
      },
    }
  );

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
  };
}

/**
 * Verify a refresh token and mint a new pair. Old refresh token is INVALIDATED
 * (single-use rotation) and expired tokens are GC'd from the worker document.
 */
export async function rotateRefreshToken(fastify, refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return { ok: false, reason: 'missing_refresh_token' };
  }
  const db = getDB();
  const worker = await db.collection('workers').findOne({
    'refreshTokens.token': refreshToken,
  });
  if (!worker) return { ok: false, reason: 'invalid_refresh_token' };

  const match = (worker.refreshTokens || []).find((r) => r.token === refreshToken);
  if (!match) return { ok: false, reason: 'invalid_refresh_token' };

  const ageMs = Date.now() - new Date(match.createdAt).getTime();
  if (ageMs > REFRESH_TTL_MS) {
    // Expired — clean it up.
    await db.collection('workers').updateOne(
      { _id: worker._id },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
    return { ok: false, reason: 'refresh_expired' };
  }

  // Rotate: remove old, garbage-collect any other expired tokens, add new.
  const cutoff = new Date(Date.now() - REFRESH_TTL_MS);
  const newToken = crypto.randomBytes(48).toString('base64url');
  const now = new Date();

  await db.collection('workers').updateOne(
    { _id: worker._id },
    {
      $pull: {
        refreshTokens: {
          $or: [
            { token: refreshToken },
            { createdAt: { $lt: cutoff } },
          ],
        },
      },
    }
  );
  await db.collection('workers').updateOne(
    { _id: worker._id },
    {
      $push: {
        refreshTokens: { token: newToken, createdAt: now, lastUsedAt: now },
      },
      $set: { lastActive: now },
    }
  );

  const accessToken = fastify.jwt.sign(
    { sub: worker._id.toString(), phone: worker.phone, typ: 'access' },
    { expiresIn: ACCESS_TTL }
  );

  return {
    ok: true,
    accessToken,
    refreshToken: newToken,
    refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
    worker: publicWorker(worker),
  };
}

export async function revokeRefreshToken(workerId, refreshToken) {
  if (!refreshToken) return;
  const db = getDB();
  try {
    await db.collection('workers').updateOne(
      { _id: new ObjectId(workerId) },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
  } catch {}
}
