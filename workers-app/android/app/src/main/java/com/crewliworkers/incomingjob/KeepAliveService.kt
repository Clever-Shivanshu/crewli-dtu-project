package com.crewliworkers.incomingjob

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Foreground service that:
 *   1. Keeps the process in the foreground bucket so FCM delivery stays in the
 *      <3s tier (bypasses Doze/App-Standby).
 *   2. Polls GPS every ~60s. If the worker has moved >500m since the last
 *      successful POST, sends the new fix to /worker/heartbeat. This keeps
 *      the matcher's location fresh even while the app is closed.
 */
class KeepAliveService : Service() {

    companion object {
        const val CHANNEL_ID = "crewli_keepalive"
        const val NOTIFICATION_ID = 7070
        private const val TAG = "CrewliKeepAlive"
        private const val RESTART_DELAY_MS = 3_000L
        private const val HEARTBEAT_INTERVAL_MS = 60_000L
        private const val MIN_DISPLACEMENT_M = 250.0
    }

    private val handler = Handler(Looper.getMainLooper())
    private var fused: FusedLocationProviderClient? = null
    private var heartbeatRunnable: Runnable? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(IncomingJobModule.PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(IncomingJobModule.KEY_AVAILABLE, false)) {
            stopSelf()
            return START_NOT_STICKY
        }

        ensureChannel()
        val n = buildNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID, n,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, n)
        }

        startHeartbeatLoop()
        Log.d(TAG, "started")
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val prefs = getSharedPreferences(IncomingJobModule.PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(IncomingJobModule.KEY_AVAILABLE, false)) {
            scheduleRestart()
        }
    }

    override fun onDestroy() {
        heartbeatRunnable?.let { handler.removeCallbacks(it) }
        super.onDestroy()
        val prefs = getSharedPreferences(IncomingJobModule.PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(IncomingJobModule.KEY_AVAILABLE, false)) {
            scheduleRestart()
        }
    }

    // ---------- heartbeat loop ----------

    private fun startHeartbeatLoop() {
        if (fused == null) fused = LocationServices.getFusedLocationProviderClient(this)
        heartbeatRunnable?.let { handler.removeCallbacks(it) }
        val r = object : Runnable {
            override fun run() {
                tickLocation()
                handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
            }
        }
        heartbeatRunnable = r
        handler.postDelayed(r, 3_000L) // first tick in ~3s so service finishes startForeground first
    }

    private fun tickLocation() {
        val fine = ActivityCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ActivityCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return

        try {
            fused?.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                ?.addOnSuccessListener { loc: Location? ->
                    if (loc == null) return@addOnSuccessListener
                    maybePostHeartbeat(loc)
                }
                ?.addOnFailureListener { t ->
                    Log.w(TAG, "getCurrentLocation failed: ${t.message}")
                }
        } catch (t: Throwable) {
            Log.w(TAG, "location request: ${t.message}")
        }
    }

    private fun maybePostHeartbeat(loc: Location) {
        val prefs = getSharedPreferences(IncomingJobModule.PREFS, Context.MODE_PRIVATE)
        val lastLat = prefs.getFloat(IncomingJobModule.KEY_LAST_LAT, Float.NaN).toDouble()
        val lastLng = prefs.getFloat(IncomingJobModule.KEY_LAST_LNG, Float.NaN).toDouble()

        val shouldSend = if (lastLat.isNaN() || lastLng.isNaN()) {
            true
        } else {
            val distance = FloatArray(1)
            Location.distanceBetween(lastLat, lastLng, loc.latitude, loc.longitude, distance)
            distance[0].toDouble() >= MIN_DISPLACEMENT_M
        }
        if (!shouldSend) return

        val token = prefs.getString(IncomingJobModule.KEY_ACCESS_TOKEN, null) ?: return
        val base = prefs.getString(IncomingJobModule.KEY_API_BASE_URL, null) ?: return

        thread(start = true, isDaemon = true, name = "crewli-heartbeat") {
            val ok = postHeartbeat(base, token, loc.latitude, loc.longitude)
            if (ok) {
                prefs.edit()
                    .putFloat(IncomingJobModule.KEY_LAST_LAT, loc.latitude.toFloat())
                    .putFloat(IncomingJobModule.KEY_LAST_LNG, loc.longitude.toFloat())
                    .apply()
                Log.d(TAG, "heartbeat sent lat=${loc.latitude} lng=${loc.longitude}")
            }
        }
    }

    private fun postHeartbeat(baseUrl: String, token: String, lat: Double, lng: Double): Boolean {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(baseUrl.trimEnd('/') + "/worker/heartbeat")
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10_000
                readTimeout = 10_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("ngrok-skip-browser-warning", "true")
            }
            val body = JSONObject().apply {
                put("location", JSONObject().put("lat", lat).put("lng", lng))
            }.toString()
            OutputStreamWriter(conn.outputStream).use { it.write(body) }
            val code = conn.responseCode
            code in 200..299
        } catch (t: Throwable) {
            Log.w(TAG, "postHeartbeat: ${t.message}")
            false
        } finally {
            try { conn?.disconnect() } catch (_: Throwable) {}
        }
    }

    // ---------- lifecycle helpers ----------

    private fun scheduleRestart() {
        try {
            val restart = Intent(applicationContext, KeepAliveService::class.java)
            val pi = PendingIntent.getService(
                applicationContext, 1, restart,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val triggerAt = System.currentTimeMillis() + RESTART_DELAY_MS
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "scheduleRestart: ${t.message}")
        }
    }

    private fun buildNotification(): Notification {
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        val pi = launch?.let {
            PendingIntent.getActivity(
                this, 0, it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle("Crewli Workers — ON WORK")
            .setContentText("Listening for incoming job offers")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pi)
            .build()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID, "Keep alive", NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Keeps the app ready to receive job offers"
                    setShowBadge(false)
                }
            )
        }
    }
}
