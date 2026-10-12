# Privacy Policy for DayPulse

**Last updated:** October 12, 2026

DayPulse ("the Application") is an open-source, local-first productivity, routine tracking, and personal finance management tool available for Web, Desktop (Electron), and Android (Capacitor).

This privacy policy explains how DayPulse handles user data and interactions with third-party services like Google Drive.

---

## 1. Local-First Data Storage
- DayPulse operates primarily as a **local-first** application.
- All your tasks, daily habit routines, checklists, and financial transactions are stored locally on your device in an embedded SQLite database.
- We do **not** run central telemetry, analytics, tracking trackers, or ad networks. Your data remains strictly on your device.

---

## 2. Google Drive Cloud Synchronization & OAuth Scopes
DayPulse provides optional cloud backup and cross-device synchronization via Google Drive.

### Scopes Requested
DayPulse requests the following Google OAuth permissions:
1. `https://www.googleapis.com/auth/userinfo.email`: To display your connected account email within the application settings.
2. `https://www.googleapis.com/auth/userinfo.profile`: To verify authentication state.
3. `https://www.googleapis.com/auth/drive.file`: To create, read, and update only the specific backup archive file (`DayPulse_Backup.json`) created by DayPulse in your personal Google Drive storage.

### How Google Data is Used
- **Restricted File Access**: DayPulse **only** accesses the `DayPulse_Backup.json` file that the Application itself creates. It does **not** have access to, read, modify, or scan any other documents, photos, or files in your Google Drive.
- **No Third-Party Transmission**: Your Google OAuth access tokens, refresh tokens, and backup data are never transmitted to third parties, analytics providers, or external servers. All tokens stored locally are encrypted using AES-256-GCM.
- **Data Retention & Deletion**: You can disconnect Google Drive at any time from **Settings -> Google Drive Cloud Sync**. You can also delete your `DayPulse_Backup.json` directly from your Google Drive at any time.

---

## 3. Data Security
- In Desktop and Web installations, OAuth tokens stored in the local SQLite database are encrypted using AES-256-GCM with authentication tags.
- On Android, authentication is handled directly by native Google Play Services without exposing plaintext tokens.

---

## 4. Open-Source Transparency
DayPulse is completely open-source. The entire source code, including backup routines and API dispatchers, is publicly inspectable at:
[https://github.com/PallabKumarS/daily-task-manager](https://github.com/PallabKumarS/daily-task-manager)

---

## 5. Contact & Support
If you have questions or concerns regarding this Privacy Policy or DayPulse:
- **Developer:** Pallab Kumar Sarker
- **GitHub Repository:** [https://github.com/PallabKumarS/daily-task-manager](https://github.com/PallabKumarS/daily-task-manager)
