package com.daypulse.tracker;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private View mChildOfContent;
    private int usableHeightPrevious = -1;
    private android.widget.FrameLayout.LayoutParams frameLayoutParams;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme_NoActionBar);
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
        applySystemThemeColors(getResources().getConfiguration());
        setupKeyboardResizeListener();
        setupAlarmNotificationChannel();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applySystemThemeColors(newConfig);
    }

    private void applySystemThemeColors(Configuration config) {
        boolean isNightMode =
            (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int bgColor = Color.parseColor(isNightMode ? "#0B0F17" : "#F5F7FB");
        int navColor = Color.parseColor(isNightMode ? "#0B0F17" : "#FFFFFF");

        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(bgColor);
            window.setNavigationBarColor(navColor);
            View decorView = window.getDecorView();
            if (decorView != null) {
                decorView.setBackgroundColor(bgColor);
                WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(window, decorView);
                if (controller != null) {
                    controller.setAppearanceLightStatusBars(!isNightMode);
                    controller.setAppearanceLightNavigationBars(!isNightMode);
                }
            }
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(bgColor);
        }
    }

    private void setupKeyboardResizeListener() {
        android.widget.FrameLayout content = findViewById(android.R.id.content);
        if (content == null) return;

        content.post(() -> {
            try {
                if (content.getChildCount() == 0) return;
                mChildOfContent = content.getChildAt(0);
                if (mChildOfContent == null) return;

                frameLayoutParams = (android.widget.FrameLayout.LayoutParams) mChildOfContent.getLayoutParams();

                content.getViewTreeObserver().addOnGlobalLayoutListener(this::possiblyResizeChildOfContent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void possiblyResizeChildOfContent() {
        if (mChildOfContent == null || frameLayoutParams == null) return;

        android.graphics.Rect r = new android.graphics.Rect();
        mChildOfContent.getWindowVisibleDisplayFrame(r);
        int usableHeightNow = r.bottom;

        int screenHeight = mChildOfContent.getRootView().getHeight();
        int heightDifference = screenHeight - usableHeightNow;

        if (heightDifference > (screenHeight / 5)) {
            if (usableHeightNow != usableHeightPrevious) {
                frameLayoutParams.height = usableHeightNow;
                mChildOfContent.requestLayout();
                usableHeightPrevious = usableHeightNow;
            }
        } else {
            if (usableHeightPrevious != -1) {
                frameLayoutParams.height = android.widget.FrameLayout.LayoutParams.MATCH_PARENT;
                mChildOfContent.requestLayout();
                usableHeightPrevious = -1;
            }
        }
    }

    private void setupAlarmNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
            if (manager != null) {
                android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_ALARM)
                    .build();

                android.net.Uri soundUri = android.net.Uri.parse(
                    "android.resource://" + getPackageName() + "/" + R.raw.daypulse_alarm
                );

                android.app.NotificationChannel channel = new android.app.NotificationChannel(
                    "daypulse_alarms_v3",
                    "DayPulse Alarms & Events",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Time-sensitive task reminders and alarm notifications");
                channel.enableLights(true);
                channel.enableVibration(true);
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                channel.setSound(soundUri, audioAttributes);
                channel.setBypassDnd(true);

                manager.createNotificationChannel(channel);
            }
        }
    }
}
