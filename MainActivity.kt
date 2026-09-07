package com.sinescapatoria.app

import android.net.Uri
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.webViewClient = WebViewClient()
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        setContentView(webView)
        loadGame(intent?.data)
    }

    private fun loadGame(uri: Uri?) {
        val invite = uri
            ?.takeIf { it.scheme == "sinescapatoria" && it.host == "invite" }
            ?.getQueryParameter("invite")
            ?.trim()

        val target = if (!invite.isNullOrEmpty()) {
            "file:///android_asset/index.html?invite=${Uri.encode(invite)}"
        } else {
            "file:///android_asset/index.html"
        }
        webView.loadUrl(target)
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
