package com.crewliworkers.incomingjob

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Re-arms the KeepAliveService after a reboot (or after the app has been
 * force-updated via the package manager) so a worker who was ON WORK when
 * the device shut down continues to receive jobs without reopening the app.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != "android.intent.action.MY_PACKAGE_REPLACED") return

        val prefs = context.getSharedPreferences(IncomingJobModule.PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(IncomingJobModule.KEY_AVAILABLE, false)) return

        try {
            val svc = Intent(context, KeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc)
            } else {
                context.startService(svc)
            }
            Log.d("CrewliBoot", "KeepAliveService started on boot")
        } catch (t: Throwable) {
            Log.w("CrewliBoot", "boot start failed: ${t.message}")
        }
    }
}
