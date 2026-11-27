package com.sounditent.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Enable edge-to-edge BEFORE super.onCreate() — required by AndroidX EdgeToEdge.
        // This sets the status bar and navigation bar to transparent and handles
        // backward compatibility back to API 21.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);

        // Make status bar icons dark-on-light or light-on-dark based on content.
        // We use a dark brand background (#020b00) so icons should be light.
        View decorView = getWindow().getDecorView();
        WindowInsetsControllerCompat insetsController =
                new WindowInsetsControllerCompat(getWindow(), decorView);
        // Light = false → white/light icons on dark status/nav bar backgrounds
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        // Apply insets to the root view so the WebView can be full-bleed while
        // the keyboard (IME) still pushes content up correctly.
        View rootView = findViewById(android.R.id.content);
        if (rootView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, windowInsets) -> {
                // Only handle IME (keyboard) insets here — system bars are drawn
                // behind the transparent WebView background by the theme & EdgeToEdge.
                boolean isImeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());
                if (isImeVisible) {
                    int imeBottom = windowInsets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
                    int navBottom = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
                    v.setPadding(0, 0, 0, Math.max(imeBottom - navBottom, 0));
                } else {
                    v.setPadding(0, 0, 0, 0);
                }
                return WindowInsetsCompat.CONSUMED;
            });
        }

        // Optimize WebView performance after bridge is ready
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();

            // Hardware acceleration & fast rendering
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            settings.setDomStorageEnabled(true);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setOffscreenPreRaster(true);

            // Fast scrolling & touch responsiveness
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);

            // Dark brand background (#020b00) to eliminate cold-boot white flash
            webView.setBackgroundColor(Color.parseColor("#020b00"));

            // Cookie & media playback optimizations
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
        }
    }
}
