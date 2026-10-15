package com.daypulse.tracker;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.view.ViewCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme_NoActionBar);
        registerPlugin(NativeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawableResource(R.color.backgroundDark);
        if (getWindow().getDecorView() != null) {
            getWindow().getDecorView().setBackgroundColor(Color.parseColor("#090A10"));
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.parseColor("#090A10"));

            getBridge().getWebView().post(() -> {
                try {
                    View parent = (View) getBridge().getWebView().getParent();
                    if (parent != null) {
                        ViewCompat.setOnApplyWindowInsetsListener(parent, (v, insets) -> {
                            v.setPadding(0, 0, 0, 0);
                            return insets;
                        });
                    }
                    getBridge().getWebView().requestApplyInsets();
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
