import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

let initialized = false;
let mainAppInitialized = false;

export function initFCM() {
  if (initialized) return;
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saPath) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT not set. Pushes will be mocked.');
  } else {
    const abs = path.resolve(saPath);
    if (!fs.existsSync(abs)) {
      console.warn(`[FCM] Service account file not found at ${abs}. Pushes will be mocked.`);
    } else {
      const serviceAccount = JSON.parse(fs.readFileSync(abs, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      initialized = true;
      console.log('[FCM] Firebase Admin initialized');
    }
  }

  // Initialize main app FCM
  const mainSaPath = 'main-app-firebase-service-account.json';
  const mainAbs = path.resolve(mainSaPath);
  if (fs.existsSync(mainAbs)) {
    const mainServiceAccount = JSON.parse(fs.readFileSync(mainAbs, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(mainServiceAccount) }, 'mainApp');
    mainAppInitialized = true;
    console.log('[FCM] Main App Firebase Admin initialized');
  } else {
    console.warn(`[FCM] Main app service account file not found at ${mainAbs}. Main app pushes will be mocked.`);
  }
}

/**
 * Send a high-priority, data-only push to a device token.
 * This is what lets us wake the device, launch a full-screen intent,
 * and bypass normal notification throttling.
 */
export async function sendJobPush(token, data) {
  if (!initialized) {
    console.log(`[FCM mock] -> ${token?.slice(0, 12)}...`, data);
    return { mocked: true };
  }

  const message = {
    token,
    // Data-only message so that FcmMessagingService.onMessageReceived is invoked
    // even when app is killed (Android). No `notification` block.
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      ttl: 15_000, // expire fast if device unreachable; we want freshness
    },
    // apns: only needed if you later add iOS
  };

  return admin.messaging().send(message);
}

export async function sendJobTakenPush(token, jobId) {
  return sendJobPush(token, { type: 'JOB_TAKEN', jobId });
}

/**
 * Send a commission status push to a worker.
 * type: 'COMMISSION_BLOCKED'
 */
export async function sendCommissionPush(token, type, balance, limit) {
  return sendJobPush(token, {
    type,
    balance: String(Math.round(balance)),
    limit: String(Math.round(limit)),
  });
}

/**
 * Send a push notification to a customer device.
 */
export async function sendCustomerPush(token, title, body, data = {}) {
  if (!mainAppInitialized) {
    console.log(`[FCM Customer mock] -> ${token?.slice(0, 12)}...`, title, body);
    return { mocked: true };
  }

  const message = {
    token,
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
    },
  };

  return admin.app('mainApp').messaging().send(message);
}
