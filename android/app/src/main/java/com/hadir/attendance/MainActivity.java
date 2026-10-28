package com.hadir.attendance;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.hardware.biometrics.BiometricPrompt;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Minimal shell around the hosted Hadir PWA.
 *
 * - Same-origin pages render inside the app; anything else (wa.me deep
 *   links, mailto:, tel:) is handed to the system browser, because
 *   window.open() targets would otherwise be silently swallowed.
 * - Implements onShowFileChooser so <input type="file"> (the profile
 *   photo picker) actually opens the system document picker — WebView
 *   does nothing without this.
 * - Injects an `AndroidAuth` JS bridge bound to Android's native
 *   BiometricPrompt: the WebView has no WebAuthn, so the app's
 *   fingerprint lock talks to this bridge instead.
 */
public class MainActivity extends Activity {

    private static final String APP_HOST = "ahmedalmeligy.github.io";
    private static final String START_URL =
            "https://ahmedalmeligy.github.io/principal-attendance-app/";
    private static final int FILE_CHOOSER_REQ = 0x51;

    // BiometricPrompt error codes (same values as the legacy
    // FingerprintManager constants; not all are public on the platform
    // class, so they are spelled out here).
    private static final int BIO_ERROR_CANCELED = 5;
    private static final int BIO_ERROR_USER_CANCELED = 10;
    private static final int BIO_ERROR_NEGATIVE_BUTTON = 13;

    private WebView web;
    private View loading;

    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService bioExecutor = Executors.newSingleThreadExecutor();
    private volatile boolean bioBusy = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        loading = findViewById(R.id.loading);
        web = findViewById(R.id.webview);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return handleUri(req.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUri(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                loading.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loading.setVisibility(View.GONE);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // window.open(..., "_blank") (the WhatsApp buttons) arrives here:
            // bounce it to a throwaway WebView that forwards the first URL out.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                                          boolean isUserGesture, android.os.Message resultMsg) {
                WebView proxy = new WebView(MainActivity.this);
                proxy.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                        openExternally(r.getUrl());
                        return true;
                    }

                    @SuppressWarnings("deprecation")
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String url) {
                        openExternally(Uri.parse(url));
                        return true;
                    }
                });
                WebView.WebViewTransport transport =
                        (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(proxy);
                resultMsg.sendToTarget();
                return true;
            }

            // File uploads (profile photo) need the host to open a picker —
            // without this override the WebView silently ignores the click.
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQ);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Native biometric bridge for the fingerprint lock (WebView has no
        // WebAuthn). Must be injected before the page loads.
        web.addJavascriptInterface(new AndroidAuthBridge(), "AndroidAuth");

        if (savedInstanceState == null) {
            web.loadUrl(START_URL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    /** Returns true when the URL left the app (and was handed off elsewhere). */
    private boolean handleUri(Uri uri) {
        String host = uri.getHost();
        if (host != null && host.endsWith(APP_HOST)) {
            return false; // our own site: keep rendering in-app
        }
        openExternally(uri);
        return true;
    }

    private void openExternally(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
            // No browser installed — nothing sensible to do.
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQ) {
            ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            if (cb != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                    results = new Uri[]{ data.getData() };
                }
                cb.onReceiveValue(results);
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ---------- biometric bridge ----------

    /** Entry point for the page's window.AndroidAuth calls. */
    public class AndroidAuthBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            try {
                android.content.pm.PackageManager pm = getPackageManager();
                return pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_FINGERPRINT)
                        || pm.hasSystemFeature("android.hardware.biometrics")
                        || pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_IRIS)
                        || pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_FACE);
            } catch (Exception e) {
                return false;
            }
        }

        /** Fire the OS biometric prompt; the answer goes back via evaluateJavascript. */
        @JavascriptInterface
        public void verify(final String requestId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startBiometricVerify(requestId);
                }
            });
        }
    }

    private void startBiometricVerify(final String requestId) {
        if (bioBusy) {
            sendBioResult(requestId, "failed");
            return;
        }
        try {
            BiometricPrompt.Builder builder = new BiometricPrompt.Builder(this)
                    .setTitle("فتح تطبيق حاضِر")
                    .setSubtitle("استخدم بصمتك أو قفل جهازك للدخول")
                    .setNegativeButton("إلغاء", bioExecutor, (dialog, which) ->
                            finishBio(requestId, "cancelled"));
            try {
                // Allowed on API 24+; lets a PIN/pattern lock unlock too.
                builder.setDeviceCredentialAllowed(true);
            } catch (Throwable ignored) {
                // Older platform — biometrics only.
            }
            BiometricPrompt prompt = builder.build();
            bioBusy = true;
            prompt.authenticate(new CancellationSignal(), bioExecutor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(
                                BiometricPrompt.AuthenticationResult result) {
                            finishBio(requestId, "ok");
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            // Fingerprint not recognized yet — the prompt stays
                            // up; a terminal onAuthenticationError follows if
                            // the user gives up or locks out.
                        }

                        @Override
                        public void onAuthenticationError(int code, CharSequence msg) {
                            boolean cancelled =
                                    code == BIO_ERROR_USER_CANCELED
                                    || code == BIO_ERROR_NEGATIVE_BUTTON
                                    || code == BIO_ERROR_CANCELED;
                            finishBio(requestId, cancelled ? "cancelled" : "failed");
                        }
                    });
        } catch (Exception e) {
            finishBio(requestId, "failed");
        }
    }

    private void finishBio(String requestId, String result) {
        bioBusy = false;
        sendBioResult(requestId, result);
    }

    private void sendBioResult(String requestId, String result) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web == null) return;
                String id = requestId.replaceAll("[^a-zA-Z0-9_.:-]", "");
                String js = "window.__hadirBiometricResult && window.__hadirBiometricResult('"
                        + id + "','" + result + "');";
                web.evaluateJavascript(js, null);
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        bioExecutor.shutdown();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
