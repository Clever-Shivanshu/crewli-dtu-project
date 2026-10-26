package com.crewliworkers

import android.content.Context
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "crewliworkers"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onResume() {
        super.onResume()
        flushPendingAction()
    }

    /**
     * If IncomingJobActivity fired an Accept/Decline before the JS bridge was warm,
     * it stashed the action in SharedPreferences. Replay it now.
     */
    private fun flushPendingAction() {
        val prefs = getSharedPreferences("crewli_pending", Context.MODE_PRIVATE)
        val action = prefs.getString("pending_action", null) ?: return
        val jobId = prefs.getString("pending_jobId", null) ?: return
        prefs.edit().clear().apply()

        val app = application as MainApplication
        val ctx = app.reactNativeHost.reactInstanceManager.currentReactContext
        if (ctx != null) {
            val params = Arguments.createMap().apply {
                putString("action", action)
                putString("jobId", jobId)
            }
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("JobAction", params)
        } else {
            prefs.edit()
                .putString("pending_action", action)
                .putString("pending_jobId", jobId)
                .apply()
        }
    }
}
