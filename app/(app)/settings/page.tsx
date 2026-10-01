"use client";

import * as React from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Upload,
  Bell,
  Volume2,
  VolumeX,
  Smartphone,
  Shield,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  User,
  DollarSign,
  Cloud,
  RefreshCw,
  ExternalLink,
  Unlink,
  FileText,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useNotifications } from "@/components/providers/notification-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/currency-symbols";

interface GoogleSyncStatus {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  lastGoogleSyncAt: string | null;
}

function SettingsContent() {
  const { user, updateProfile } = useAuth();
  const searchParams = useSearchParams();
  const {
    permission,
    soundEnabled,
    requestPermission,
    toggleSound,
    triggerNotification,
  } = useNotifications();

  const [name, setName] = React.useState(user?.name || "");
  const [currency, setCurrency] = React.useState(user?.currency || "USD");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  // Google Sync state
  const [googleStatus, setGoogleStatus] = React.useState<GoogleSyncStatus>({
    configured: false,
    connected: false,
    googleEmail: null,
    lastGoogleSyncAt: null,
  });
  const [syncingGoogle, setSyncingGoogle] = React.useState(false);
  const [restoringGoogle, setRestoringGoogle] = React.useState(false);
  const [simulating, setSimulating] = React.useState(false);
  const [showSetupGuide, setShowSetupGuide] = React.useState(false);

  const fetchGoogleStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sync/google/status");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setGoogleStatus(json.data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setCurrency(user.currency);
    }
  }, [user]);

  React.useEffect(() => {
    fetchGoogleStatus();

    // Check for callback query params
    const syncStatus = searchParams.get("sync_status");
    const syncError = searchParams.get("sync_error");
    const emailParam = searchParams.get("email");

    if (syncStatus === "connected") {
      toast.success(`Google Account connected: ${emailParam || ""}`);
    } else if (syncError) {
      toast.error(`Google connection error: ${decodeURIComponent(syncError)}`);
    }
  }, [fetchGoogleStatus, searchParams]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    await updateProfile({ name, currency });
    setSavingProfile(false);
  };

  const handleExportBackup = async () => {
    try {
      const res = await fetch("/api/backup/export");
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error("Failed to generate backup");
        return;
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json.data, null, 2));
      const downloadAnchor = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `DayPulse_Backup_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success("Backup downloaded successfully. Keep it safe or sync to Google Drive.");
    } catch {
      toast.error("Error creating backup download");
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || "Data restored successfully");
        window.dispatchEvent(new CustomEvent("daypulse:refresh"));
      } else {
        toast.error(json.message || "Failed to restore backup");
      }
    } catch {
      toast.error("Invalid JSON backup file");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  // Google Sync Actions
  const handleConnectGoogle = () => {
    if (!googleStatus.configured) {
      toast.error("Google OAuth credentials are not set in .env. Use the setup guide below or try the simulator.");
      setShowSetupGuide(true);
      return;
    }
    window.location.href = "/api/sync/google/auth";
  };

  const handleUploadGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const res = await fetch("/api/sync/google/upload", { method: "POST" });
      const json = await res.json();

      if (res.ok && json.success) {
        toast.success(json.message || "Google Drive sync completed!");
        fetchGoogleStatus();
      } else {
        toast.error(json.message || "Failed to backup to Google Drive");
      }
    } catch {
      toast.error("Network error during Google Drive sync");
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleRestoreGoogle = async () => {
    if (!confirm("Are you sure you want to restore data from your Google Drive backup?")) return;
    setRestoringGoogle(true);
    try {
      const res = await fetch("/api/sync/google/restore", { method: "POST" });
      const json = await res.json();

      if (res.ok && json.success) {
        toast.success(json.message || "Data restored from Google Drive!");
        window.dispatchEvent(new CustomEvent("daypulse:refresh"));
      } else {
        toast.error(json.message || "Failed to restore from Google Drive");
      }
    } catch {
      toast.error("Network error during Google Drive restore");
    } finally {
      setRestoringGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Are you sure you want to disconnect your Google Account?")) return;
    try {
      const res = await fetch("/api/sync/google/disconnect", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Google Account disconnected");
        fetchGoogleStatus();
      } else {
        toast.error(json.message || "Failed to disconnect");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const handleSimulateSync = async (action: "upload" | "restore") => {
    setSimulating(true);
    try {
      const res = await fetch("/api/sync/google/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        toast.success(json.message);
        fetchGoogleStatus();
        if (action === "restore") {
          window.dispatchEvent(new CustomEvent("daypulse:refresh"));
        }
      } else {
        toast.error(json.message || "Simulation failed");
      }
    } catch {
      toast.error("Simulation request error");
    } finally {
      setSimulating(false);
    }
  };

  const testAlarm = () => {
    triggerNotification({
      title: "DayPulse System Alert & Chime",
      message: "Proactive alert reminder is active! You will be notified ahead of tasks and routines.",
      type: "system",
    });
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Cloud Sync</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure Google Drive cloud synchronization, profile preferences, audio alarms, and local backups.
        </p>
      </div>

      {/* Google Drive Cloud Sync Hub */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Google Drive Cloud Sync</h2>
              <p className="text-[11px] text-slate-400">Automated multi-device cloud backup & restore</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                googleStatus.connected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {googleStatus.connected
                ? `Connected: ${googleStatus.googleEmail}`
                : "Not Connected"}
            </span>
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-200">
              Cloud Archive File: <span className="text-emerald-400 font-mono">DayPulse_Backup.json</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {googleStatus.lastGoogleSyncAt
                ? `Last synchronized: ${new Date(googleStatus.lastGoogleSyncAt).toLocaleString()}`
                : "No cloud sync performed yet"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!googleStatus.connected ? (
              <Button
                variant="emerald"
                size="sm"
                onClick={handleConnectGoogle}
                className="gap-2 text-xs"
              >
                <KeyRound className="w-4 h-4" />
                <span>Connect Google Drive</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="emerald"
                  size="sm"
                  onClick={handleUploadGoogle}
                  disabled={syncingGoogle}
                  className="gap-2 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogle ? "animate-spin" : ""}`} />
                  <span>{syncingGoogle ? "Syncing..." : "Sync & Backup Now"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreGoogle}
                  disabled={restoringGoogle}
                  className="gap-2 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{restoringGoogle ? "Restoring..." : "Restore from Drive"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectGoogle}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs gap-1"
                  title="Disconnect Google Account"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Sandbox Simulation / Instant Test Box */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/15 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200">Google Drive Sandbox Simulator</span>
            </div>
            <span className="text-[10px] text-cyan-400 uppercase font-semibold">Immediate Local Test</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Test the complete cloud synchronization lifecycle (payload validation, cloud archiving, and atomic database restoration) immediately without needing external API credentials.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleSimulateSync("upload")}
              disabled={simulating}
              className="text-xs gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Simulate Cloud Backup</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSimulateSync("restore")}
              disabled={simulating}
              className="text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Cloud Restore</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Setup Guide */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition cursor-pointer font-medium"
          >
            <span>{showSetupGuide ? "Hide" : "Show"} Google Cloud OAuth setup instructions (.env)</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          {showSetupGuide && (
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 space-y-2 leading-relaxed">
              <p className="font-semibold text-white">How to connect your own Google Cloud Client ID & Secret:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                <li>Go to <strong className="text-slate-200">Google Cloud Console</strong> &gt; APIs &amp; Services &gt; Credentials.</li>
                <li>Create an <strong className="text-slate-200">OAuth 2.0 Client ID</strong> (Web Application).</li>
                <li>
                  Add Authorized Redirect URI:
                  <div className="mt-1 rounded-lg bg-slate-900 p-2 font-mono text-emerald-400 select-all border border-slate-800">
                    http://localhost:3000/api/sync/google/callback
                  </div>
                </li>
                <li>Enable the <strong className="text-slate-200">Google Drive API</strong> in your project.</li>
                <li>Add the following keys to your project <strong className="text-slate-200">.env</strong>:
                  <pre className="mt-1 rounded-lg bg-slate-900 p-2 font-mono text-slate-300 border border-slate-800">
GOOGLE_CLIENT_ID=&quot;your-client-id.apps.googleusercontent.com&quot;
GOOGLE_CLIENT_SECRET=&quot;your-client-secret&quot;
                  </pre>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Manual JSON Backup & Offline Archival */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <FileText className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">Direct JSON Backup & Offline Archival</h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Download your complete database in an open, portable JSON format. You can manually drag and drop this file into your Google Drive, email it, or restore it on any computer.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Export JSON */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-200">
              <Download className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Export Data Snapshot</h3>
            </div>
            <p className="text-xs text-slate-400">
              Download routines, habits, tasks, routine logs, and financial records into a single JSON file.
            </p>
            <Button variant="emerald" size="sm" onClick={handleExportBackup} className="w-full gap-2">
              <Download className="w-4 h-4" />
              <span>Download JSON Backup</span>
            </Button>
          </div>

          {/* Import JSON */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-200">
              <Upload className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Restore / Import File</h3>
            </div>
            <p className="text-xs text-slate-400">
              Restore routines, events, and transactions from a previous DayPulse backup file.
            </p>
            <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/80 cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span>{importing ? "Importing..." : "Choose Backup File..."}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Notification & Audio Engine */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Bell className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Notification & Alarm Engine</h2>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-950">
            <div>
              <p className="text-sm font-semibold text-slate-200">OS System & Browser Push</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Displays native popups ahead of scheduled routines and task deadlines.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  permission === "granted"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}
              >
                {permission === "granted" ? "Granted" : "Needs Permission"}
              </span>
              {permission !== "granted" && (
                <Button size="sm" variant="default" onClick={requestPermission}>
                  Enable
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-950">
            <div>
              <p className="text-sm font-semibold text-slate-200">Harmonic Audio Chime</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Plays a synthesized dual-tone harmonic chime on alert triggers.
              </p>
            </div>
            <Button
              size="sm"
              variant={soundEnabled ? "emerald" : "secondary"}
              onClick={toggleSound}
              className="gap-2 self-start sm:self-center"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? "Audio On" : "Muted"}</span>
            </Button>
          </div>

          <div className="pt-1">
            <Button variant="outline" size="sm" onClick={testAlarm} className="gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span>Test Audio Chime & Notification Now</span>
            </Button>
          </div>
        </div>
      </div>

      {/* User Preferences */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <User className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">User Profile & Currency</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Default Currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="emerald" size="sm" disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save Preferences"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-20 text-center text-xs text-slate-400">
          Loading settings & cloud sync hub...
        </div>
      }
    >
      <SettingsContent />
    </React.Suspense>
  );
}
