package com.crewliworkers.calldirect

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CallDirectModule(private val ctx: ReactApplicationContext)
    : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "CallDirect"

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val ok = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CALL_PHONE) ==
                 PackageManager.PERMISSION_GRANTED
        promise.resolve(ok)
    }

    /**
     * Attempts a direct call. If CALL_PHONE isn't granted, falls back to the
     * dialer (ACTION_DIAL) so the user still gets a 1-tap-to-confirm call.
     * Resolves true when the direct call was started, false when the dialer
     * was used as fallback.
     */
    @ReactMethod
    fun call(phone: String, promise: Promise) {
        try {
            val hasPerm = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CALL_PHONE) ==
                          PackageManager.PERMISSION_GRANTED
            val action = if (hasPerm) Intent.ACTION_CALL else Intent.ACTION_DIAL
            val intent = Intent(action).apply {
                data = Uri.parse("tel:$phone")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(intent)
            promise.resolve(hasPerm)
        } catch (e: Throwable) {
            promise.reject("CALL_FAILED", e.message, e)
        }
    }

    @Suppress("UNUSED_PARAMETER")
    @ReactMethod fun addListener(eventName: String) {}
    @Suppress("UNUSED_PARAMETER")
    @ReactMethod fun removeListeners(count: Int) {}
}
