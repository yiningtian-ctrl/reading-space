package space.readspace.android;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int OPEN_FILE = 10, SAVE_FILE = 11, PAPER = 0xfff6f8f0;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout failure;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingExport;
    private WebMessagePort[] ports;
    private OnBackInvokedCallback backCallback;
    private final ExecutorService writes = Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);
        setContentView(root);
        configureInsets(root);
        web = new WebView(this);
        web.setBackgroundColor(PAPER);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(0xff335b3e));
        root.addView(progress, new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP));
        failure = failurePanel();
        root.addView(failure, new FrameLayout.LayoutParams(-1, -1));
        failure.setVisibility(View.GONE);
        configureWebView();
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::goBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
        if (state == null || web.restoreState(state) == null || !UrlPolicy.trusted(web.getUrl())) web.loadUrl(UrlPolicy.ORIGIN + "/");
    }

    @SuppressWarnings("deprecation") private void configureInsets(View root) {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            });
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) controller.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
        }
    }

    @SuppressWarnings("SetJavaScriptEnabled") private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        // Content URIs are granted only by the system file picker for backup import.
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(true);
        s.setUserAgentString(s.getUserAgentString() + " ReadSpaceAndroid/1.0.0");
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (UrlPolicy.trusted(url)) return false;
                if (request.isForMainFrame() && request.hasGesture()) openExternal(url);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                closePorts();
                failure.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
                if (UrlPolicy.trusted(url)) connectDownloads();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showFailure();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showFailure();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                showFailure();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!UrlPolicy.trusted(view.getUrl())) return false;
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (ActivityNotFoundException e) { fileCallback.onReceiveValue(null); fileCallback = null; message("未找到文件选择器"); }
                return true;
            }
        });
    }

    private void connectDownloads() {
        closePorts();
        try (InputStream in = getAssets().open("downloads.js")) {
            ByteArrayOutputStream source = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int count;
            while ((count = in.read(buffer)) != -1) source.write(buffer, 0, count);
            String script = new String(source.toByteArray(), StandardCharsets.UTF_8);
            String token = UUID.randomUUID().toString();
            WebMessagePort[] channel = web.createWebMessageChannel();
            ports = channel;
            channel[0].setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                @Override public void onMessage(WebMessagePort port, WebMessage message) {
                    if (ports == channel && UrlPolicy.trusted(web.getUrl())) receiveExport(message.getData());
                }
            });
            web.evaluateJavascript(script.replace("__READSPACE_PORT_TOKEN__", JSONObject.quote(token)), ignored -> {
                if (ports == channel && UrlPolicy.trusted(web.getUrl())) web.postWebMessage(new WebMessage(token, new WebMessagePort[]{channel[1]}), Uri.parse(UrlPolicy.ORIGIN));
            });
        } catch (Exception e) { message("文件导出暂不可用，请稍后重试"); }
    }

    private void receiveExport(String raw) {
        if (pendingExport != null) { message("请先完成当前文件保存"); return; }
        try {
            if (raw == null || raw.length() > 13_500_000) throw new IllegalArgumentException();
            JSONObject item = new JSONObject(raw);
            if (item.optBoolean("error")) throw new IllegalArgumentException();
            byte[] bytes = Base64.decode(item.getString("body"), Base64.DEFAULT);
            if (bytes.length > 10_000_000) throw new IllegalArgumentException();
            String mime = item.optString("type");
            if (!mime.matches("(?:application/json|text/(?:csv|markdown|plain))")) mime = "application/octet-stream";
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime);
            intent.putExtra(Intent.EXTRA_TITLE, UrlPolicy.filename(item.optString("name")));
            pendingExport = bytes;
            startActivityForResult(intent, SAVE_FILE);
        } catch (Exception e) { pendingExport = null; message("导出失败，请重试或在浏览器中导出"); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_FILE && fileCallback != null) {
            Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
            // Only the explicitly chosen document is passed to the website.
            if (uri != null && !"content".equals(uri.getScheme())) uri = null;
            fileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
            fileCallback = null;
        }
        if (request == SAVE_FILE) {
            byte[] bytes = pendingExport;
            pendingExport = null;
            Uri destination = result == RESULT_OK && data != null ? data.getData() : null;
            if (bytes == null || destination == null || !"content".equals(destination.getScheme())) return;
            writes.execute(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                    if (out == null) throw new java.io.IOException();
                    out.write(bytes);
                    runOnUiThread(() -> message("文件已保存"));
                } catch (Exception e) { runOnUiThread(() -> message("保存失败，请重新导出")); }
            });
        }
    }

    private LinearLayout failurePanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(32), dp(28), dp(32));
        panel.setBackgroundColor(PAPER);
        TextView title = new TextView(this);
        title.setText(R.string.connection_title); title.setTextSize(23); title.setTextColor(0xff25352e);
        panel.addView(title);
        TextView text = new TextView(this);
        text.setText(R.string.connection_help);
        text.setTextSize(15); text.setTextColor(0xff606b62); text.setPadding(0, dp(18), 0, dp(24)); text.setLineSpacing(dp(5), 1);
        panel.addView(text);
        Button retry = new Button(this); retry.setText(R.string.retry); retry.setOnClickListener(v -> { failure.setVisibility(View.GONE); web.loadUrl(UrlPolicy.ORIGIN + "/"); }); panel.addView(retry);
        Button browser = new Button(this); browser.setText(R.string.open_browser); browser.setOnClickListener(v -> openExternal(UrlPolicy.ORIGIN + "/")); panel.addView(browser);
        return panel;
    }
    private void showFailure() { closePorts(); progress.setVisibility(View.GONE); failure.setVisibility(View.VISIBLE); }
    private void openExternal(String raw) {
        if (!UrlPolicy.external(raw)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(raw)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException e) { message("未找到可打开链接的浏览器"); }
    }
    private void closePorts() { if (ports != null) { for (WebMessagePort port : ports) try { port.close(); } catch (Exception ignored) {} ports = null; } }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void message(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private void goBack() { if (web.canGoBack()) web.goBack(); else moveTaskToBack(true); }
    // API 33+ registers OnBackInvokedCallback above; this override serves API 24–32 only.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation") @Override public void onBackPressed() { goBack(); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onSaveInstanceState(Bundle out) { web.saveState(out); super.onSaveInstanceState(out); }
    @Override protected void onDestroy() {
        closePorts();
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        web.destroy(); writes.shutdown(); super.onDestroy();
    }
}
