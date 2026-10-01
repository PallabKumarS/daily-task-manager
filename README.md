# DayPulse — Daily Activity Flow, Routine Mastery & Financial Pulse

> An all-in-one daily productivity and wealth tracking web application built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, and Prisma ORM.

---

## Features

### 1. Daily Activity & Routine Loops
- Group routines by time slots: **Morning**, **Afternoon**, **Evening**, **Night**, and **Anytime**.
- Active days of week configuration (Sunday through Saturday).
- Target completion times with proactive advance notifications.
- Streak engine with habit milestone celebrations.

### 2. Task & Event Precision Scheduler
- Discrete separation between **Tasks** (action items) and **Events** (time meetings/engagements).
- Priority Matrix: **Low**, **Medium**, **High**, and **Urgent**.
- Due date/time tracking with overdue status indicators.
- Advance reminder lead times: 5m, 10m, 15m, 30m, 1h before deadline.

### 3. Cumulative Spendings & Earnings Ledger
- Daily transaction logging for **Spendings** (expenses) and **Earnings** (income).
- Itemized categories (Food, Housing & Bills, Transport, Salary, Freelance, Investments, etc.).
- Multi-currency support: USD ($), EUR (€), GBP (£), BDT (৳), INR (₹), CAD, AUD, JPY.
- Cumulative cashflow trajectory chart (running net balance over days/months/years).
- Period toggles: **Weekly**, **Monthly**, and **Yearly** analysis.
- Automatic savings rate calculation (`Net / Income * 100`).

### 4. Dual Notification & Alarm Engine
- **Harmonic Audio Chime**: Synthesized dual-tone audio chime (C5/G5 harmonic sine waves) via standard HTML5 Web Audio API (works 100% offline, zero external audio assets required).
- **Native OS / Browser Push Notifications**: Triggers system alerts for upcoming tasks, events, and routine targets.
- **In-App Notification Center**: History drawer tracking notifications with unread badges, mark-read, and quick mute switches.

### 5. Multi-User & Multi-Device Synchronization
- User registration and JWT authentication with secure HTTP-only cookies and Bearer token compatibility.
- Instant synchronization across all logged-in devices (phones, tablets, laptops, desktops).
- **One-Click JSON Data Export**: Full backup archive for Google Drive, offline backup, or device transfer.
- **One-Click JSON Data Restore**: Transaction-safe data import.

### 6. Cross-Platform Ready (PWA / APK / EXE)
- Mobile-first responsive UI with bottom dock on phones and expandable sidebar on desktops.
- Web app manifest for direct PWA homescreen installation.
- Clean RESTful API architecture ready to be packaged with **Capacitor** (Android APK) or **Electron** (Desktop EXE).

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- npm or bun

### 2. Installation
```bash
npm install
```

### 3. Database Initialization
```bash
npx prisma db push
```

### 4. Running Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) or open `http://<your-local-ip>:3000` from your phone on the same Wi-Fi.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## Project Structure

```
├── app/
│   ├── (app)/                  # Authenticated app routes
│   │   ├── dashboard/          # Daily overview & quick logs
│   │   ├── routines/           # Daily habits & streaks
│   │   ├── tasks/              # Scheduled tasks & calendar events
│   │   ├── finances/           # Cumulative spendings & earnings ledger
│   │   └── settings/           # Sync, backup, audio & profile preferences
│   ├── api/                    # Modular Next.js route handlers
│   │   ├── auth/               # register, login, logout, me
│   │   ├── routines/           # routines CRUD & toggle streak
│   │   ├── tasks/              # tasks CRUD
│   │   ├── finances/           # transactions CRUD & cumulative analytics
│   │   └── backup/             # export & import JSON backups
│   ├── login/                  # Sign-in page
│   ├── register/               # Sign-up page
│   ├── globals.css             # Tailwind v4 theme tokens
│   ├── layout.tsx              # Root provider wrapper
│   └── page.tsx                # Landing page
├── components/
│   ├── dashboard/              # Overview widgets & summaries
│   ├── routines/               # Routine list, streak badges, form modals
│   ├── tasks/                  # Task filter bars, items, form modals
│   ├── finances/               # Cumulative SVG chart, breakdown, transaction list
│   ├── landing/                # Hero section, feature grids, navbar & footer
│   ├── layout/                 # Sidebar, mobile dock, notification center
│   ├── providers/              # AuthProvider, NotificationProvider
│   └── ui/                     # Accessible button, input, card, modal, badge
├── lib/
│   ├── prisma.ts               # PrismaClient singleton instance
│   ├── jwt-auth.ts             # Token issuance & password hashing
│   ├── send-response.ts        # Standardized API response format
│   ├── audio-chime.ts          # HTML5 Web Audio harmonic chime
│   ├── web-notification.ts     # Native browser notification wrapper
│   ├── currency-symbols.ts     # Currency options & categories
│   ├── date-helpers.ts         # Formatting & streak calculations
│   └── utils.ts                # Tailwind class merger (cn)
└── prisma/
    └── schema.prisma           # Prisma schema (SQLite / PostgreSQL ready)
```

---

## Export & Google Drive Sync Workflow
1. Navigate to **Sync & Settings** in DayPulse.
2. Click **Download Backup (JSON)** to save your complete account snapshot (`DayPulse_Backup_YYYY-MM-DD.json`).
3. You can store this file in your Google Drive or sync folder.
4. On any new device or instance, click **Choose Backup File...** to instantly restore all routines, events, and transactions.
