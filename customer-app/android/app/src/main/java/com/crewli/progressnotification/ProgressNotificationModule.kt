package com.crewli.progressnotification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ProgressNotificationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val CHANNEL_ID = "crewli_delivery_progress"
        private const val NOTIFICATION_ID = 9001
    }

    override fun getName() = "ProgressNotification"

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Worker Arrival",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Shows real-time worker arrival progress"
                    setShowBadge(false)
                }
                mgr.createNotificationChannel(channel)
            }
        }
    }

    /**
     * Show or update the progress notification.
     * @param title e.g. "Almost at your doorstep"
     * @param body e.g. "Be there to collect your order"
     * @param progress 0-100 representing how close the worker is
     */
    @ReactMethod
    fun showProgress(title: String, body: String, progress: Int) {
        ensureChannel()

        val ctx = reactApplicationContext
        val mgr = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Use a custom layout for the notification
        val layoutId = ctx.resources.getIdentifier("notification_progress", "layout", ctx.packageName)

        if (layoutId != 0) {
            // Custom layout exists
            val remoteViews = RemoteViews(ctx.packageName, layoutId)
            remoteViews.setTextViewText(
                ctx.resources.getIdentifier("notification_title", "id", ctx.packageName),
                title
            )
            remoteViews.setTextViewText(
                ctx.resources.getIdentifier("notification_body", "id", ctx.packageName),
                body
            )
            remoteViews.setProgressBar(
                ctx.resources.getIdentifier("notification_progress_bar", "id", ctx.packageName),
                100,
                progress.coerceIn(0, 100),
                false
            )

            val iconResId = ctx.resources.getIdentifier("ic_launcher", "mipmap", ctx.packageName)

            val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(iconResId)
                .setCustomContentView(remoteViews)
                .setCustomBigContentView(remoteViews)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .build()

            mgr.notify(NOTIFICATION_ID, notification)
        } else {
            // Fallback: standard notification with progress bar
            val iconResId = ctx.resources.getIdentifier("ic_launcher", "mipmap", ctx.packageName)

            val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(iconResId)
                .setContentTitle(title)
                .setContentText(body)
                .setProgress(100, progress.coerceIn(0, 100), false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setColor(0xFF7C3AED.toInt()) // Purple
                .build()

            mgr.notify(NOTIFICATION_ID, notification)
        }
    }

    /**
     * Dismiss the progress notification.
     */
    @ReactMethod
    fun dismiss() {
        val mgr = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.cancel(NOTIFICATION_ID)
    }
}
