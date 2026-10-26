package com.crewliworkers.incomingjob

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class IncomingJobModule(private val ctx: ReactApplicationContext)
    : ReactContextBaseJavaModule(ctx) {

    companion object {
        const val PREFS = "crewli_prefs"
        const val KEY_AVAILABLE = "isAvailable"
        const val KEY_ACCESS_TOKEN = "accessToken"
        const val KEY_API_BASE_URL = "apiBaseUrl"
        const val KEY_LAST_LAT = "lastLat"
        const val KEY_LAST_LNG = "lastLng"
    }

    override fun getName() = "IncomingJob"

    @ReactMethod
    fun showIncomingJob(payload: ReadableMap) {
        val intent = Intent(ctx, IncomingJobActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            val it = payload.entryIterator
            while (it.hasNext()) {
                val (k, v) = it.next()
                putExtra(k, v.toString())
            }
        }
        ctx.startActivity(intent)
    }

    /**
     * Called from JS when a JOB_TAKEN FCM arrives while the app is in the foreground.
     * The jobId MUST be included so the takenReceiver equality check in
     * IncomingJobActivity passes and the activity actually closes + stops ringing.
     */
    @ReactMethod
    fun dismissIncomingJob(jobId: String) {
        val intent = Intent(IncomingJobActivity.ACTION_JOB_TAKEN).apply {
            putExtra("jobId", jobId)
            setPackage(ctx.packageName)
        }
        ctx.sendBroadcast(intent)
    }

    /** Persisted ON/OFF flag — read by KeepAliveService and BootReceiver. */
    @ReactMethod
    fun setAvailable(available: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_AVAILABLE, available)
            .apply()
        if (available) startKeepAlive() else stopKeepAlive()
    }

    /**
     * JS calls this whenever the access token changes (login, refresh). Stored in
     * SharedPreferences so KeepAliveService can POST /worker/heartbeat while the
     * app is closed and FCM is temporarily idle.
     */
    @ReactMethod
    fun setAuthContext(accessToken: String, baseUrl: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_API_BASE_URL, baseUrl)
            .apply()
    }

    @ReactMethod
    fun startKeepAlive() {
        val i = Intent(ctx, KeepAliveService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i)
            } else {
                ctx.startService(i)
            }
        } catch (_: Throwable) {}
    }

    @ReactMethod
    fun stopKeepAlive() {
        try { ctx.stopService(Intent(ctx, KeepAliveService::class.java)) } catch (_: Throwable) {}
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        promise.resolve(pm.isIgnoringBatteryOptimizations(ctx.packageName))
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${ctx.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try { ctx.startActivity(intent) } catch (_: Throwable) {}
    }

    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val can = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            nm.canUseFullScreenIntent()
        } else true
        promise.resolve(can)
    }

    @ReactMethod
    fun requestFullScreenIntentPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
            data = Uri.parse("package:${ctx.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try { ctx.startActivity(intent) } catch (_: Throwable) {}
    }

    @ReactMethod
    fun hasNotificationsEnabled(promise: Promise) {
        promise.resolve(NotificationManagerCompat.from(ctx).areNotificationsEnabled())
    }

    @ReactMethod
    fun openAppNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try { ctx.startActivity(intent) } catch (_: Throwable) {}
    }

    @ReactMethod
    fun openAutoStartSettings() {
        val candidates = listOf(
            ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
            ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
            ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
            ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
            ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
            ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
            ComponentName("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"),
            ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
        )
        for (cn in candidates) {
            val intent = Intent().apply {
                component = cn
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            try {
                ctx.startActivity(intent)
                return
            } catch (_: Throwable) {}
        }
        val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${ctx.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try { ctx.startActivity(fallback) } catch (_: Throwable) {}
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        val can = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(ctx)
        } else true
        promise.resolve(can)
    }

    @ReactMethod
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        if (Settings.canDrawOverlays(ctx)) return
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
            data = Uri.parse("package:${ctx.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try { ctx.startActivity(intent) } catch (_: Throwable) {}
    }

    @Suppress("UNUSED_PARAMETER")
    @ReactMethod fun addListener(eventName: String) {}
    @Suppress("UNUSED_PARAMETER")
    @ReactMethod fun removeListeners(count: Int) {}
}
