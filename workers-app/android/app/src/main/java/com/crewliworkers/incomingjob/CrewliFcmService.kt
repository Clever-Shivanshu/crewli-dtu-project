package com.crewliworkers.incomingjob

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives the data-only, high-priority FCM push. This handler runs even when
 * the app is killed. From here we:
 *   1. Acquire a partial WakeLock (briefly) to keep CPU on
 *   2. Post a SILENT ongoing notification (no channel sound) so Android knows
 *      there is active UI — the IncomingJobActivity handles all ringtone/vibration
 *   3. Directly launch IncomingJobActivity so the ringer + UI appear immediately
 *
 * Double-ring fix: the previous CHANNEL_ID had IMPORTANCE_HIGH + setSound(), which
 * played the ringtone when the notification was posted AND again when the activity
 * called startRingtoneAndVibrate(). We now post to SILENT_CHANNEL_ID (IMPORTANCE_LOW,
 * no sound, no vibration) so only the activity's ringtone plays.
 */
class CrewliFcmService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "CrewliFcm"

        /** Legacy high-importance channel — kept for FCM delivery priority metadata only.
         *  New ongoing status-bar notifications use SILENT_CHANNEL_ID instead. */
        const val CHANNEL_ID = "crewli_incoming_jobs"

        /** Silent channel used for the ongoing status-bar notification shown while
         *  IncomingJobActivity is open. No sound, no vibration — the activity handles that. */
        const val SILENT_CHANNEL_ID = "crewli_job_overlay"

        /** Channel for commission alert notifications (warning / blocked). */
        const val COMMISSION_CHANNEL_ID = "crewli_commission"

        const val NOTIFICATION_ID = 7777
        private const val COMMISSION_NOTIFICATION_ID = 7778
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "new FCM token: ${token.take(12)}...")
        // JS layer will pick this up via messaging().onTokenRefresh().
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val type = data["type"]
        Log.d(TAG, "FCM received type=$type")

        when (type) {
            "JOB_OFFER"            -> handleJobOffer(data)
            "JOB_TAKEN"            -> handleJobTaken(data)
            "COMMISSION_BLOCKED"   -> handleCommissionAlert(data, isBlocked = true)
        }
    }

    private fun handleJobOffer(data: Map<String, String>) {
        ensureChannels()
        acquireWakeLock()

        val intent = Intent(this, IncomingJobActivity::class.java).apply {
            flags = (Intent.FLAG_ACTIVITY_NEW_TASK
                    or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    or Intent.FLAG_ACTIVITY_NO_HISTORY)
            for ((k, v) in data) putExtra(k, v)
        }

        val pending = PendingIntent.getActivity(
            this,
            data["jobId"]?.hashCode() ?: 0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = km.isKeyguardLocked

        val canOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else true

        // ── Use SILENT channel so the notification itself makes NO sound.
        // IncomingJobActivity.startRingtoneAndVibrate() handles all audio exclusively.
        val notificationBuilder = NotificationCompat.Builder(this, SILENT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("New job offer")
            .setContentText("${data["jobType"] ?: "Service"} • ₹${data["priceEstimate"] ?: "-"}")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pending)

        // If we can't draw overlays, use full-screen-intent so Android shows a
        // heads-up popup on top of whatever is running — still silent channel.
        if (!canOverlay) {
            notificationBuilder
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(pending, true)
        }

        val notification = notificationBuilder.build()
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)

        if (canOverlay || (!isLocked && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q)) {
            try { startActivity(intent) } catch (t: Throwable) { Log.w(TAG, "startActivity: ${t.message}") }
        }
    }

    private fun handleJobTaken(data: Map<String, String>) {
        val jobId = data["jobId"] ?: return
        // Broadcast to running activity (if any) to dismiss itself.
        // The jobId MUST be included so takenReceiver's equality check passes.
        val intent = Intent(IncomingJobActivity.ACTION_JOB_TAKEN).apply {
            putExtra("jobId", jobId)
            setPackage(packageName)
        }
        sendBroadcast(intent)

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID)
    }

    private fun handleCommissionAlert(data: Map<String, String>, isBlocked: Boolean) {
        ensureChannels()
        val balance = data["balance"] ?: "?"
        val limit   = data["limit"]   ?: "500"

        val title = if (isBlocked)
            "⛔ Jobs paused — commission due"
        else
            "⚠️ Commission balance: ₹$balance"

        val body = if (isBlocked)
            "Your commission balance (₹$balance) has reached the ₹$limit limit. Pay now to resume receiving jobs."
        else
            "You've accumulated ₹$balance of commission (limit ₹$limit). Pay before reaching the limit."

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val n = NotificationCompat.Builder(this, COMMISSION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(if (isBlocked) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        nm.notify(COMMISSION_NOTIFICATION_ID, n)
    }

    /**
     * Creates the three notification channels this service uses:
     * - CHANNEL_ID (legacy / manifest metadata — IMPORTANCE_HIGH kept for FCM priority)
     * - SILENT_CHANNEL_ID (IMPORTANCE_LOW, no sound) — for the ongoing offer notification
     * - COMMISSION_CHANNEL_ID — for commission warning/block alerts
     *
     * Channel properties are set only on first creation; subsequent calls to
     * createNotificationChannel() with the same ID are silently ignored by Android.
     */
    private fun ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // 1. Legacy high-importance channel (keeps FCM high-priority delivery configured).
        //    We delete then recreate it WITHOUT a ringtone so existing installs stop double-ringing.
        if (nm.getNotificationChannel(CHANNEL_ID) != null) {
            nm.deleteNotificationChannel(CHANNEL_ID)
        }
        val legacyChannel = NotificationChannel(
            CHANNEL_ID,
            "Incoming Jobs",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Ringing notifications for incoming job offers"
            enableVibration(false)
            enableLights(true)
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            // No setSound() — IncomingJobActivity owns all audio.
        }
        nm.createNotificationChannel(legacyChannel)

        // 2. Silent overlay channel — used for the actual ongoing notification.
        if (nm.getNotificationChannel(SILENT_CHANNEL_ID) == null) {
            val silentChannel = NotificationChannel(
                SILENT_CHANNEL_ID,
                "Job Offer Overlay",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Silent status-bar notification shown while a job offer screen is open"
                enableVibration(false)
                enableLights(false)
                setSound(null, null)
            }
            nm.createNotificationChannel(silentChannel)
        }

        // 3. Commission alert channel.
        if (nm.getNotificationChannel(COMMISSION_CHANNEL_ID) == null) {
            val commissionChannel = NotificationChannel(
                COMMISSION_CHANNEL_ID,
                "Commission Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Alerts about your commission balance"
            }
            nm.createNotificationChannel(commissionChannel)
        }
    }

    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            val wl = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "crewli:fcm"
            )
            // Short timeout just to bridge to the activity which will take over.
            wl.acquire(5_000)
            // Release automatically via timeout.
        } catch (t: Throwable) {
            Log.w(TAG, "wakelock: ${t.message}")
        }
    }
}
