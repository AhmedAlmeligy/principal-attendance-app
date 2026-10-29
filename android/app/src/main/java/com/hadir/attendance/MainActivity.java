package com.hadir.attendance;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.hardware.biometrics.BiometricPrompt;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
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
    private static final int STORAGE_REQ = 0x52;
    private static final String FILE_PROVIDER = "com.hadir.attendance.fileprovider";
    private static final String TAG = "Hadir";

    private byte[] pendingSaveData;
    private String pendingSaveName;

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

        // Match the shell (bars, window, WebView) to the phone's theme until
        // the page tells us which theme is active inside the app.
        boolean night = (getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        applyTheme(night);

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

        // Native bridges injected before the page loads:
        //  - AndroidAuth: the fingerprint lock (WebView has no WebAuthn)
        //  - AndroidFiles: saving/sharing the report PDF
        //  - AndroidTheme: status/navigation bar colours
        web.addJavascriptInterface(new AndroidAuthBridge(), "AndroidAuth");
        web.addJavascriptInterface(new AndroidFilesBridge(), "AndroidFiles");
        web.addJavascriptInterface(new AndroidThemeBridge(), "AndroidTheme");

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
            BiometricPrompt.Builder builder = newBiometricBuilder(requestId);
            try {
                // Lets a PIN/pattern lock unlock too when no biometric is set.
                builder.setDeviceCredentialAllowed(true);
            } catch (Throwable ignored) {
                // Older platform — biometrics only.
            }
            BiometricPrompt prompt;
            try {
                prompt = builder.build();
            } catch (Throwable t) {
                // Some devices reject device-credential + negative button
                // combinations; retry with a plain biometric prompt.
                prompt = newBiometricBuilder(requestId).build();
            }
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
            Log.e(TAG, "biometric prompt failed", e);
            finishBio(requestId, "failed");
        }
    }

    private BiometricPrompt.Builder newBiometricBuilder(final String requestId) {
        return new BiometricPrompt.Builder(this)
                .setTitle("فتح تطبيق حاضِر")
                .setSubtitle("استخدم بصمتك أو قفل جهازك للدخول")
                .setNegativeButton("إلغاء", bioExecutor, (dialog, which) ->
                        finishBio(requestId, "cancelled"));
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

    // ---------- file bridge (report PDFs) ----------

    /** Entry point for the page's window.AndroidFiles calls. */
    public class AndroidFilesBridge {
        @JavascriptInterface
        public void savePdf(String base64, String filename) {
            final byte[] data = decode(base64);
            if (data == null) {
                toast("تعذر حفظ التقرير");
                return;
            }
            if (Build.VERSION.SDK_INT >= 29) {
                saveToDownloads(data, filename);
                return;
            }
            if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    == PackageManager.PERMISSION_GRANTED) {
                saveToDownloadsLegacy(data, filename);
            } else {
                // Ask once, then finish the save in onRequestPermissionsResult.
                pendingSaveData = data;
                pendingSaveName = filename;
                requestPermissions(new String[]{ Manifest.permission.WRITE_EXTERNAL_STORAGE },
                        STORAGE_REQ);
            }
        }

        @JavascriptInterface
        public void sharePdf(String base64, final String filename) {
            final byte[] data = decode(base64);
            if (data == null) {
                toast("تعذر مشاركة التقرير");
                return;
            }
            new Thread(() -> {
                try {
                    File dir = new File(getCacheDir(), "shares");
                    if (!dir.exists()) dir.mkdirs();
                    File out = new File(dir, safeName(filename));
                    try (FileOutputStream fos = new FileOutputStream(out)) {
                        fos.write(data);
                    }
                    final Uri uri = FileProvider.getUriForFile(
                            MainActivity.this, FILE_PROVIDER, out);
                    runOnUiThread(() -> {
                        Intent intent = new Intent(Intent.ACTION_SEND);
                        intent.setType("application/pdf");
                        intent.putExtra(Intent.EXTRA_STREAM, uri);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try {
                            startActivity(Intent.createChooser(intent, "مشاركة التقرير"));
                        } catch (Exception e) {
                            toast("لا توجد طريقة لمشاركة الملف");
                        }
                    });
                } catch (Exception e) {
                    Log.e(TAG, "share failed", e);
                    runOnUiThread(() -> toast("تعذر مشاركة التقرير"));
                }
            }, "hadir-share").start();
        }
    }

    /** API 29+: MediaStore, no storage permission needed. */
    private void saveToDownloads(byte[] data, String filename) {
        ContentValues values = new ContentValues();
        Uri uri = null;
        try {
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName(filename));
            values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
            values.put(MediaStore.Downloads.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            uri = getContentResolver().insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("insert failed");
            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                if (os == null) throw new IOException("no stream");
                os.write(data);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(uri, values, null, null);
            toast("تم حفظ التقرير في مجلد Downloads");
        } catch (Exception e) {
            Log.e(TAG, "save failed", e);
            if (uri != null) {
                try {
                    getContentResolver().delete(uri, null, null);
                } catch (Exception ignored) {
                }
            }
            toast("تعذر حفظ التقرير");
        }
    }

    /** API 24–28: needs WRITE_EXTERNAL_STORAGE, granted at runtime. */
    private void saveToDownloadsLegacy(byte[] data, String filename) {
        try {
            File dir = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, safeName(filename));
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(data);
            }
            MediaScannerConnection.scanFile(this,
                    new String[]{ out.getAbsolutePath() }, null, null);
            toast("تم حفظ التقرير في مجلد Downloads");
        } catch (Exception e) {
            Log.e(TAG, "legacy save failed", e);
            toast("تعذر حفظ التقرير — تحقق من صلاحية التخزين");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           String[] permissions,
                                           int[] grantResults) {
        if (requestCode == STORAGE_REQ) {
            byte[] data = pendingSaveData;
            String name = pendingSaveName;
            pendingSaveData = null;
            pendingSaveName = null;
            if (data == null) return;
            if (grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                saveToDownloadsLegacy(data, name);
            } else {
                toast("لا يمكن حفظ الملف بدون إذن التخزين");
            }
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    // ---------- theme bridge ----------

    /** Entry point for the page's window.AndroidTheme calls. */
    public class AndroidThemeBridge {
        @JavascriptInterface
        public void setDark(final boolean dark) {
            runOnUiThread(() -> applyTheme(dark));
        }
    }

    /** Keeps the system bars in step with the theme chosen inside the app. */
    private void applyTheme(boolean dark) {
        try {
            int status = getColor(dark
                    ? R.color.hadir_status_dark : R.color.hadir_status_light);
            int nav = getColor(dark
                    ? R.color.hadir_nav_dark : R.color.hadir_nav_light);
            int bg = getColor(dark
                    ? R.color.hadir_bg_dark : R.color.hadir_bg_light);

            getWindow().setStatusBarColor(status);
            getWindow().setNavigationBarColor(nav);
            getWindow().setBackgroundDrawableResource(dark
                    ? R.color.hadir_bg_dark : R.color.hadir_bg_light);

            View decor = getWindow().getDecorView();
            int flags = decor.getSystemUiVisibility();
            if (dark) {
                flags &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                        | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            } else {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                        | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            decor.setSystemUiVisibility(flags);

            if (web != null) web.setBackgroundColor(bg);
        } catch (Exception e) {
            Log.e(TAG, "theme update failed", e);
        }
    }

    // ---------- small helpers ----------

    private byte[] decode(String base64) {
        if (base64 == null || base64.isEmpty()) return null;
        try {
            return Base64.decode(base64, Base64.DEFAULT);
        } catch (Exception e) {
            Log.e(TAG, "base64 decode failed", e);
            return null;
        }
    }

    /** Keeps saved filenames to a safe, portable set of characters. */
    private String safeName(String name) {
        String cleaned = (name == null ? "" : name)
                .replaceAll("[^\\p{L}\\p{N}._-]", "_");
        if (!cleaned.toLowerCase().endsWith(".pdf")) cleaned += ".pdf";
        return cleaned.isEmpty() ? "report.pdf" : cleaned;
    }

    private void toast(final String message) {
        runOnUiThread(() ->
                Toast.makeText(getApplicationContext(), message, Toast.LENGTH_SHORT).show());
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
