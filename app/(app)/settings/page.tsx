"use client";

import * as React from "react";
import { toast } from "sonner";
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
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useNotifications } from "@/components/providers/notification-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/currency-symbols";

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
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

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setCurrency(user.currency);
    }
  }, [user]);

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
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Data Sync</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure profile preferences, alarm audio chimes, desktop push alerts, and multi-device cloud backups.
        </p>
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

      {/* Notification & Audio Engine */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Bell className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Notification & Audio Engine</h2>
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
                Plays a gentle synthesized dual-tone harmonic chime on alert triggers.
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

      {/* Cloud Sync & Backup Data */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Cloud className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-bold text-white">Multi-Device Sync & Google Drive Backup</h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Your routines, tasks, and financial records are automatically bound to your authenticated account. Any device (phone, PC, laptop) logging into your account has real-time access to the exact same synchronized records.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Export JSON */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-200">
              <Download className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Export Data Backup</h3>
            </div>
            <p className="text-xs text-slate-400">
              Download your full database (habits, tasks, routine logs, finances) in clean JSON format for Google Drive, offline storage, or transfer.
            </p>
            <Button variant="emerald" size="sm" onClick={handleExportBackup} className="w-full gap-2">
              <Download className="w-4 h-4" />
              <span>Download Backup (JSON)</span>
            </Button>
          </div>

          {/* Import JSON */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-200">
              <Upload className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Restore / Import Backup</h3>
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

        {/* Cross platform readiness note */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 flex items-start gap-3 mt-4">
          <Laptop className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-white">Cross-Platform Packaging (APK / EXE Ready)</p>
            <p className="text-slate-400 leading-relaxed">
              DayPulse is structured with responsive touch-friendly navigation, REST APIs, and viewport scaling. It can be wrapped into a Capacitor Android APK or an Electron Desktop EXE anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
