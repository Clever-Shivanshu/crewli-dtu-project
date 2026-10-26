package com.crewliworkers.incomingjob

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.bridge.Arguments
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import com.facebook.react.modules.core.DeviceEventManagerModule

class IncomingJobActivity : AppCompatActivity() {

    companion object {
        const val ACTION_JOB_TAKEN = "com.crewliworkers.incomingjob.JOB_TAKEN"
        private const val DEFAULT_TIMEOUT_MS = 30_000L
    }

    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var jobId: String = ""
    private var countdownView: TextView? = null
    private var topProgressBar: ProgressBar? = null
    private var maxTimeLeftMs = DEFAULT_TIMEOUT_MS
    private var timeLeftMs = DEFAULT_TIMEOUT_MS
    private var handleView: View? = null
    private var swipeTrackView: View? = null
    private var handleCenterX = 0f
    private var swipeThreshold = 0f
    private var actionTaken = false

    private val takenReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.getStringExtra("jobId") == jobId) {
                finishAndCleanup()
            }
        }
    }

    @SuppressLint("SetTextI18n", "ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setupWindowFlags()
        acquireFullWakeLock()

        jobId = intent.getStringExtra("jobId") ?: ""
        val jobType = intent.getStringExtra("jobType") ?: "Service"
        val distance = intent.getStringExtra("distanceKm") ?: "—"
        val price = intent.getStringExtra("priceEstimate") ?: "—"
        val address = intent.getStringExtra("address") ?: ""
        val category = intent.getStringExtra("category") ?: ""
        val subProblem = intent.getStringExtra("subProblemTitle") ?: ""
        val postCleaning = intent.getStringExtra("postCleaning") == "true"

        // Calculate remaining time from sentAt (accounts for network delay)
        val sentAt = intent.getStringExtra("sentAt")?.toLongOrNull() ?: System.currentTimeMillis()
        val expiresInMs = intent.getStringExtra("expiresInMs")?.toLongOrNull() ?: DEFAULT_TIMEOUT_MS
        val elapsed = System.currentTimeMillis() - sentAt
        timeLeftMs = maxOf(3000L, expiresInMs - elapsed) // at least 3 seconds
        maxTimeLeftMs = expiresInMs

        setContentView(buildCallStyleView(jobType, distance, price, address, category, subProblem, postCleaning))

        startRingtoneAndVibrate()

        // Register "job taken" receiver
        val filter = IntentFilter(ACTION_JOB_TAKEN)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(takenReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(takenReceiver, filter)
        }

        startCountdown()
    }

    private fun startCountdown() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                timeLeftMs -= 1000
                if (timeLeftMs <= 0) {
                    countdownView?.text = "0s remaining"
                    topProgressBar?.progress = 0
                    emitAction("missed")
                    finishAndCleanup()
                } else {
                    countdownView?.text = "${timeLeftMs / 1000}s remaining"
                    topProgressBar?.progress = timeLeftMs.toInt()
                    handler.postDelayed(this, 1000)
                }
            }
        }, 1000)
    }

    private fun setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            km.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun acquireFullWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            wakeLock = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "crewli:incoming-job"
            ).apply { acquire(timeLeftMs + 5_000L) }
        } catch (_: Throwable) {}
    }

    // ─── CALL-STYLE UI ─────────────────────────────────────────────────

    @SuppressLint("ClickableViewAccessibility")
    private fun buildCallStyleView(
        jobType: String, distance: String, price: String, address: String,
        category: String, subProblem: String, postCleaning: Boolean
    ): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#F5F5F7"))
            gravity = Gravity.CENTER_HORIZONTAL
        }

        topProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(4))
            max = maxTimeLeftMs.toInt()
            progress = timeLeftMs.toInt()
            progressDrawable.setColorFilter(Color.parseColor("#EF4444"), android.graphics.PorterDuff.Mode.SRC_IN)
        }
        root.addView(topProgressBar)

        // ── Top: Logo + countdown ──
        val topSection = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(40), dp(24), dp(20))
        }

        val logoView = ImageView(this).apply {
            setImageResource(com.crewliworkers.R.drawable.crewli_logo)
            layoutParams = LinearLayout.LayoutParams(dp(160), dp(80)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
            }
        }
        topSection.addView(logoView)

        countdownView = TextView(this).apply {
            text = "${timeLeftMs / 1000}s remaining"
            setTextColor(Color.parseColor("#EF4444"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(12), 0, 0)
            gravity = Gravity.CENTER
        }
        topSection.addView(countdownView)
        root.addView(topSection)

        // ── Middle: Job info card ──
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val bg = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = dp(20).toFloat()
            }
            background = bg
            elevation = dp(2).toFloat()
            setPadding(dp(24), dp(24), dp(24), dp(24))
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(dp(20), 0, dp(20), 0)
            }
            layoutParams = lp
        }

        // Job type (large)
        card.addView(TextView(this).apply {
            text = jobType.uppercase()
            setTextColor(Color.parseColor("#111827"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        })

        // Category badge (e.g. Electrical, Plumbing)
        if (category.isNotBlank()) {
            val badge = TextView(this).apply {
                text = category.uppercase()
                setTextColor(Color.parseColor("#7C3AED"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                typeface = Typeface.DEFAULT_BOLD
                letterSpacing = 0.1f
                setPadding(dp(12), dp(6), dp(12), dp(6))
                val bg = GradientDrawable().apply {
                    setColor(Color.parseColor("#F3E8FF"))
                    cornerRadius = dp(16).toFloat()
                }
                background = bg
                gravity = Gravity.CENTER
                val lp = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    gravity = Gravity.CENTER_HORIZONTAL
                    topMargin = dp(8)
                }
                layoutParams = lp
            }
            card.addView(badge)
        }

        // Only show subProblem if it's different from the main jobType
        if (subProblem.isNotBlank() && !subProblem.equals(jobType, ignoreCase = true)) {
            card.addView(TextView(this).apply {
                text = subProblem
                setTextColor(Color.parseColor("#6B7280"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                gravity = Gravity.CENTER
                setPadding(0, dp(6), 0, 0)
            })
        }

        // Divider
        card.addView(View(this).apply {
            setBackgroundColor(Color.parseColor("#F3F4F6"))
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
            lp.topMargin = dp(16)
            lp.bottomMargin = dp(12)
            layoutParams = lp
        })

        card.addView(infoRow("Distance", "$distance km", "#3B82F6"))
        card.addView(infoRow("Earnings", "₹$price + ₹10/km", "#22C55E"))
        if (address.isNotBlank()) card.addView(infoRow("Location", address, "#F59E0B", singleLine = false))
        card.addView(infoRow("Cleaning", if (postCleaning) "Included" else "Not included", "#8B5CF6"))

        root.addView(card)

        // ── Spacer ──
        root.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, 0, 1f)
        })

        // ── Bottom: Swipe area ──
        val swipeSection = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(16), dp(24), dp(40))
        }

        swipeSection.addView(TextView(this).apply {
            text = "Swipe to respond"
            setTextColor(Color.parseColor("#9CA3AF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(16))
        })

        // Swipe track with icons
        val trackHeight = dp(72)
        val trackWidth = LinearLayout.LayoutParams.MATCH_PARENT
        val track = FrameLayout(this).apply {
            val lp = LinearLayout.LayoutParams(trackWidth, trackHeight)
            layoutParams = lp
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#E5E7EB"))
                cornerRadius = trackHeight / 2f
            }
            background = bg
        }

        // Decline icon (left)
        val declineIcon = SwipeIcon(this, false, Color.parseColor("#EF4444"))
        declineIcon.layoutParams = FrameLayout.LayoutParams(dp(48), dp(48)).apply {
            gravity = Gravity.CENTER_VERTICAL or Gravity.START
            marginStart = dp(14)
        }
        track.addView(declineIcon)

        // Accept icon (right)
        val acceptIcon = SwipeIcon(this, true, Color.parseColor("#22C55E"))
        acceptIcon.layoutParams = FrameLayout.LayoutParams(dp(48), dp(48)).apply {
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            marginEnd = dp(14)
        }
        track.addView(acceptIcon)

        // Draggable handle (center)
        val handleSize = dp(60)
        val handle = View(this).apply {
            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.WHITE)
            }
            background = bg
            elevation = dp(6).toFloat()
        }
        val handleLp = FrameLayout.LayoutParams(handleSize, handleSize).apply {
            gravity = Gravity.CENTER
        }
        handle.layoutParams = handleLp
        track.addView(handle)
        handleView = handle
        swipeTrackView = track

        // Inner phone icon in handle
        val phoneIcon = ImageView(this).apply {
            setImageResource(android.R.drawable.sym_action_call)
            setColorFilter(Color.parseColor("#22C55E"))
            layoutParams = FrameLayout.LayoutParams(dp(32), dp(32)).apply {
                gravity = Gravity.CENTER
            }
        }
        track.addView(phoneIcon)

        // Pulse the phone icon
        ValueAnimator.ofFloat(0.85f, 1f).apply {
            duration = 1000
            repeatMode = ValueAnimator.REVERSE
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener {
                val scale = it.animatedValue as Float
                phoneIcon.scaleX = scale
                phoneIcon.scaleY = scale
            }
            start()
        }

        // Touch handling for swipe
        track.post {
            handleCenterX = (track.width / 2f) - (handleSize / 2f)
            swipeThreshold = track.width * 0.30f
            handle.translationX = 0f
        }

        var startX = 0f
        var startTranslation = 0f

        handle.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = event.rawX
                    startTranslation = v.translationX
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - startX
                    val maxLeft = -(track.width / 2f - handleSize)
                    val maxRight = (track.width / 2f - handleSize)
                    val newTrans = (startTranslation + dx).coerceIn(maxLeft, maxRight)
                    v.translationX = newTrans

                    // Visual feedback on icons
                    if (newTrans > swipeThreshold) {
                        acceptIcon.alpha = 1f
                        declineIcon.alpha = 0.3f
                    } else if (newTrans < -swipeThreshold) {
                        declineIcon.alpha = 1f
                        acceptIcon.alpha = 0.3f
                    } else {
                        acceptIcon.alpha = 0.6f
                        declineIcon.alpha = 0.6f
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val finalTrans = v.translationX
                    if (finalTrans > swipeThreshold && !actionTaken) {
                        // Accept
                        actionTaken = true
                        v.animate().translationX(track.width / 2f - handleSize.toFloat())
                            .setDuration(200).withEndAction { doAccept() }.start()
                    } else if (finalTrans < -swipeThreshold && !actionTaken) {
                        // Decline
                        actionTaken = true
                        v.animate().translationX(-(track.width / 2f - handleSize.toFloat()))
                            .setDuration(200).withEndAction { doDecline() }.start()
                    } else {
                        // Spring back
                        v.animate().translationX(0f).setDuration(300)
                            .setInterpolator(OvershootInterpolator()).start()
                        acceptIcon.alpha = 0.6f
                        declineIcon.alpha = 0.6f
                    }
                    true
                }
                else -> false
            }
        }

        swipeSection.addView(track)
        root.addView(swipeSection)

        return root
    }

    private fun infoRow(label: String, value: String, dotColor: String, singleLine: Boolean = false): View {
        val r = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.TOP // Allow multi-line values to start at top
            setPadding(0, dp(8), 0, dp(8))
        }
        // Colored dot
        val dot = View(this).apply {
            val lp = LinearLayout.LayoutParams(dp(8), dp(8))
            lp.marginEnd = dp(12)
            lp.topMargin = dp(6) // Align with first line of text
            layoutParams = lp
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor(dotColor))
            }
        }
        r.addView(dot)
        r.addView(TextView(this).apply {
            text = label
            setTextColor(Color.parseColor("#6B7280"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        r.addView(TextView(this).apply {
            text = value
            setTextColor(Color.parseColor("#111827"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.END
            val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.5f)
            layoutParams = lp
            if (singleLine) {
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
            }
        })
        return r
    }

    // SVG-like paths for Accept/Decline icons
    class SwipeIcon(context: Context, private val isAccept: Boolean, private val color: Int) : View(context) {
        private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            this.color = this@SwipeIcon.color
        }
        private val iconPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = dp(3).toFloat()
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            this.color = Color.WHITE
        }
        private fun dp(v: Int): Int = (v * context.resources.displayMetrics.density).toInt()

        init { alpha = 0.6f }

        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            val r = minOf(cx, cy)
            canvas.drawCircle(cx, cy, r, bgPaint)

            val s = r * 0.4f // icon half-size
            if (isAccept) {
                // Checkmark
                canvas.drawLine(cx - s*0.8f, cy, cx - s*0.1f, cy + s*0.7f, iconPaint)
                canvas.drawLine(cx - s*0.1f, cy + s*0.7f, cx + s*0.9f, cy - s*0.6f, iconPaint)
            } else {
                // Cross
                canvas.drawLine(cx - s*0.6f, cy - s*0.6f, cx + s*0.6f, cy + s*0.6f, iconPaint)
                canvas.drawLine(cx - s*0.6f, cy + s*0.6f, cx + s*0.6f, cy - s*0.6f, iconPaint)
            }
        }
    }

    private fun doAccept() {
        val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (km.isKeyguardLocked) {
            km.requestDismissKeyguard(this@IncomingJobActivity, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() {
                    acceptDirectly()
                }
            })
        } else {
            acceptDirectly()
        }
    }

    private fun doDecline() {
        emitAction("reject")
        finishAndCleanup()
    }

    private fun dp(v: Int): Int =
        (v * resources.displayMetrics.density).toInt()

    private fun startRingtoneAndVibrate() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(this, uri).apply {
                audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isLooping = true
                play()
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
                val loop = object : Runnable {
                    override fun run() {
                        if (ringtone?.isPlaying == false) ringtone?.play()
                        handler.postDelayed(this, 1_500)
                    }
                }
                handler.postDelayed(loop, 1_500)
            }
        } catch (_: Throwable) {}

        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            val pattern = longArrayOf(0, 800, 600)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (_: Throwable) {}
    }

    private fun emitAction(action: String) {
        try {
            val app = application as com.crewliworkers.MainApplication
            val reactContext = app.reactNativeHost.reactInstanceManager.currentReactContext
            if (reactContext != null) {
                val params = Arguments.createMap().apply {
                    putString("action", action)
                    putString("jobId", jobId)
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("JobAction", params)
            } else {
                getSharedPreferences("crewli_pending", Context.MODE_PRIVATE)
                    .edit()
                    .putString("pending_action", action)
                    .putString("pending_jobId", jobId)
                    .apply()
                val launch = Intent(this, com.crewliworkers.MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                startActivity(launch)
            }
        } catch (_: Throwable) {}
    }

    private fun acceptDirectly() {
        val prefs = getSharedPreferences("crewli_prefs", Context.MODE_PRIVATE)
        val token = prefs.getString("accessToken", null)
        val baseUrl = prefs.getString("apiBaseUrl", null)

        if (token == null || baseUrl == null) {
            emitAction("accept")
            finishAndCleanup()
            return
        }

        Thread {
            try {
                val url = URL("$baseUrl/jobs/accept")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Accept", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.doOutput = true

                val json = JSONObject()
                json.put("jobId", jobId)

                OutputStreamWriter(conn.outputStream).use { it.write(json.toString()) }

                val code = conn.responseCode
                runOnUiThread {
                    if (code in 200..299) {
                        Toast.makeText(this@IncomingJobActivity, "Job accepted, kindly open your app", Toast.LENGTH_LONG).show()
                        emitAction("accepted_external")
                        finishAndCleanup()
                    } else {
                        Toast.makeText(this@IncomingJobActivity, "Failed to accept ($code)", Toast.LENGTH_SHORT).show()
                        emitAction("accept")
                        finishAndCleanup()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    emitAction("accept")
                    finishAndCleanup()
                }
            }
        }.start()
    }

    private fun finishAndCleanup() {
        try { ringtone?.stop() } catch (_: Throwable) {}
        try { vibrator?.cancel() } catch (_: Throwable) {}
        try { wakeLock?.release() } catch (_: Throwable) {}
        try { unregisterReceiver(takenReceiver) } catch (_: Throwable) {}
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(CrewliFcmService.NOTIFICATION_ID)
        handler.removeCallbacksAndMessages(null)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        try { ringtone?.stop() } catch (_: Throwable) {}
        try { vibrator?.cancel() } catch (_: Throwable) {}
        try { wakeLock?.release() } catch (_: Throwable) {}
    }

    override fun onBackPressed() {
        // Prevent accidental dismissal — force a swipe choice.
    }
}
