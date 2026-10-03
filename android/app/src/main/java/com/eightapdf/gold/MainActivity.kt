package com.eightapdf.gold

import android.Manifest
import android.app.DownloadManager
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.*
import org.json.JSONObject
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private val webUrl = "https://8apdf.vercel.app/?android=1"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        FirebaseBootstrap.init(this)
        NotificationSupport.channels(this)
        Schedules.daily(this)
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("test-reminder-sync", ExistingPeriodicWorkPolicy.KEEP, PeriodicWorkRequestBuilder<TestReminderWorker>(24, TimeUnit.HOURS).build())
        requestNotificationsOnce()
        web = WebView(this)
        configureWebView(web)
        setContentView(web)
        web.loadUrl(webUrl)
    }

    private fun requestNotificationsOnce() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED && !getPreferences(MODE_PRIVATE).getBoolean("asked_notifications", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("asked_notifications", true).apply()
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 42)
        }
    }

    private fun configureWebView(view: WebView) {
        view.settings.apply { javaScriptEnabled = true; domStorageEnabled = true; databaseEnabled = true; builtInZoomControls = false; displayZoomControls = false; cacheMode = WebSettings.LOAD_DEFAULT; mediaPlaybackRequiresUserGesture = true; userAgentString = "$userAgentString 8aPDF-Android/1.0" }
        view.setLayerType(WebView.LAYER_TYPE_HARDWARE, null)
        view.addJavascriptInterface(AndroidBridge(this), "EightaPdfAndroid")
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean = openExternalOrKeep(request.url.toString())
            override fun onPageFinished(v: WebView, url: String) { super.onPageFinished(v, url); injectAndroidBridge(v) }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(v: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean {
                val transport = resultMsg.obj as WebView.WebViewTransport
                transport.webView = WebView(this@MainActivity).also { child -> child.settings.javaScriptEnabled = true; child.webViewClient = object : WebViewClient() { override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean { openExternalOrKeep(request.url.toString()); return true } } }
                resultMsg.sendToTarget(); return true
            }
        }
        view.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val req = DownloadManager.Request(Uri.parse(url)).setTitle(name).setDescription("Downloading from 8aPDF").setMimeType(mimeType).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED).setAllowedOverMetered(true).setAllowedOverRoaming(true)
            getSystemService(DownloadManager::class.java).enqueue(req)
        }
    }

    private fun injectAndroidBridge(v: WebView) {
        val js = """
            (() => { window.__EIGHTAPDF_ANDROID__=true;
              window.EightaPdfAndroidReady=true;
              const hide=()=>{const m=document.getElementById('permissionModal'); if(m){m.classList.remove('show');m.setAttribute('aria-hidden','true');}};
              hide(); new MutationObserver(hide).observe(document.documentElement,{subtree:true,childList:true,attributes:true});
              if(!navigator.share && window.EightaPdfAndroid){ navigator.share=async o=>EightaPdfAndroid.share((o&&o.title)||'8aPDF',(o&&o.text)||'',(o&&o.url)||''); }
            })();
        """.trimIndent()
        v.evaluateJavascript(js, null)
    }

    private fun openExternalOrKeep(url: String): Boolean {
        if (url.startsWith("https://8apdf.vercel.app") || url.startsWith("https://8apdf.xo.je")) return false
        return try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))); true } catch (_: Exception) { false }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); intent?.getStringExtra("destination")?.let { destination -> if (destination != "home") web.evaluateJavascript("window.location.hash=${JSONObject.quote(destination)}", null) } }
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }
}

private object FirebaseBootstrap {
    fun init(context: Context) {
        if (FirebaseApp.getApps(context).isNotEmpty()) return
        val options = FirebaseOptions.Builder().setApiKey("AIzaSyATxKki6gkNWic_CnoGbZnOZjAUj1lbKGI").setApplicationId("1:933297255268:android:8aPDFgold").setProjectId("academyvault-5d1eb").setStorageBucket("academyvault-5d1eb.firebasestorage.app").build()
        FirebaseApp.initializeApp(context, options)
    }
}

private class AndroidBridge(private val context: Context) {
    @JavascriptInterface fun share(title: String, text: String, url: String) { val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TITLE, title).putExtra(Intent.EXTRA_TEXT, listOf(text, url).filter { it.isNotBlank() }.joinToString("\n")); context.startActivity(Intent.createChooser(send, "Share with")) }
    @JavascriptInterface fun openNotificationSettings() { context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
