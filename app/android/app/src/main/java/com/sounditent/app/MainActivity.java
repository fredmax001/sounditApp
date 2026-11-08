package com.sounditent.app;

import android.os.Bundle;
import android.view.View;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);

        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets systemBars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                boolean isImeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());

                int bottomPadding = isImeVisible ? Math.max(imeInsets.bottom, systemBars.bottom) : systemBars.bottom;
                v.setPadding(systemBars.left, systemBars.top, systemBars.right, bottomPadding);

                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(contentView);
        }
    }
}
