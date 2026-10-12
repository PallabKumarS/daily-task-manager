package com.daypulse.tracker;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    private GoogleSignInClient googleSignInClient;

    @PluginMethod
    public void signIn(PluginCall call) {
        try {
            Scope driveScope = new Scope("https://www.googleapis.com/auth/drive.file");
            Scope emailScope = new Scope("https://www.googleapis.com/auth/userinfo.email");
            Scope profileScope = new Scope("https://www.googleapis.com/auth/userinfo.profile");

            String serverClientId = call.getString("serverClientId", null);

            GoogleSignInOptions.Builder gsoBuilder = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(driveScope, emailScope, profileScope);

            if (serverClientId != null && !serverClientId.trim().isEmpty()) {
                gsoBuilder.requestIdToken(serverClientId.trim());
                gsoBuilder.requestServerAuthCode(serverClientId.trim());
            }

            googleSignInClient = GoogleSignIn.getClient(getActivity(), gsoBuilder.build());

            googleSignInClient.signOut().addOnCompleteListener(getActivity(), task -> {
                Intent signInIntent = googleSignInClient.getSignInIntent();
                startActivityForResult(call, signInIntent, "handleSignInResult");
            });
        } catch (Exception e) {
            call.reject("Failed to initialize Google Sign-In: " + e.getMessage(), e);
        }
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            Intent data = result.getData();
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            GoogleSignInAccount account = task.getResult(ApiException.class);

            if (account == null) {
                call.reject("Google Sign-In canceled or failed.");
                return;
            }

            new Thread(() -> {
                try {
                    String scope = "oauth2:https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
                    String accessToken = GoogleAuthUtil.getToken(getContext(), account.getAccount(), scope);

                    JSObject ret = new JSObject();
                    ret.put("accessToken", accessToken);
                    ret.put("email", account.getEmail());
                    ret.put("name", account.getDisplayName());
                    ret.put("id", account.getId());
                    ret.put("idToken", account.getIdToken());
                    ret.put("serverAuthCode", account.getServerAuthCode());
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to obtain OAuth access token: " + e.getMessage(), e);
                }
            }).start();
        } catch (ApiException e) {
            call.reject("Google Sign-In error (code " + e.getStatusCode() + "): " + e.getMessage(), e);
        } catch (Exception e) {
            call.reject("Sign-in handling failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        try {
            if (googleSignInClient == null) {
                GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).build();
                googleSignInClient = GoogleSignIn.getClient(getActivity(), gso);
            }
            googleSignInClient.signOut().addOnCompleteListener(getActivity(), task -> {
                call.resolve();
            });
        } catch (Exception e) {
            call.reject("Failed to sign out: " + e.getMessage(), e);
        }
    }
}
