import { NativeModules, Platform } from 'react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

const { IncomingJob } = NativeModules as {
  IncomingJob?: {
    showIncomingJob: (payload: Record<string, string>) => void;
    /** jobId is required — takenReceiver checks it for equality. */
    dismissIncomingJob: (jobId: string) => void;
  };
};

/**
 * Foreground FCM handler. The Kotlin FcmMessagingService does the heavy lifting
 * (waking device, showing full-screen-intent, ringtone) for background + killed
 * states directly — we do NOT re-invoke showIncomingJob from JS here, which
 * would cause a double launch.
 *
 * For JOB_TAKEN we broadcast to the running native IncomingJobActivity so it
 * self-dismisses (stops ringing, closes the offer screen).
 *
 * Bug fix: the previous call to dismissIncomingJob() omitted the jobId, so the
 * takenReceiver's equality check always failed and the activity never closed.
 */
export async function handleBackgroundJobMessage(
  msg: FirebaseMessagingTypes.RemoteMessage
) {
  if (Platform.OS !== 'android') return;
  const data = msg?.data || {};

  if (data.type === 'JOB_TAKEN') {
    const jobId = data.jobId;
    if (jobId) {
      try {
        IncomingJob?.dismissIncomingJob(String(jobId));
      } catch {}
    }
  }
  // JOB_OFFER is fully handled by CrewliFcmService.onMessageReceived in native code.
  // COMMISSION_BLOCKED is handled by CrewliFcmService as well.
}
