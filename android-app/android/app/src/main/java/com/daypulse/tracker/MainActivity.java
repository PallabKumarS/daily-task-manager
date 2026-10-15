package com.daypulse.tracker;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme_NoActionBar);
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawableResource(R.color.backgroundDark);
        View decorView = getWindow().getDecorView();
        if (decorView != null) {
            decorView.setBackgroundColor(Color.parseColor("#0B0F17"));
            ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
                v.setPadding(0, 0, 0, 0);
                return new WindowInsetsCompat.Builder(insets)
                    .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                    .build();
            });
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.parseColor("#0B0F17"));

            getBridge().getWebView().post(() -> {
                try {
                    View webView = getBridge().getWebView();
                    View parent = (View) webView.getParent();
                    androidx.core.view.OnApplyWindowInsetsListener insetsListener = (v, insets) -> {
                        v.setPadding(0, 0, 0, 0);
                        return new WindowInsetsCompat.Builder(insets)
                            .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                            .build();
                    };

                    if (parent != null) {
                        ViewCompat.setOnApplyWindowInsetsListener(parent, insetsListener);
                    }
                    ViewCompat.setOnApplyWindowInsetsListener(webView, insetsListener);
                    webView.requestApplyInsets();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        setupAlarmNotificationChannel();
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
