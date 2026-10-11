import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import { app } from "electron";
import {
	configureSessionStore,
	getActiveUserId,
	readPersistedSessionUserId,
	restoreSession,
} from "./session-store.js";

let prismaInstance: PrismaClient | null = null;

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "GoogleConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "googleId" TEXT,
    "googleEmail" TEXT,
    "encryptedAccess" TEXT NOT NULL,
    "encryptedRefresh" TEXT,
    "tokenExpiry" DATETIME,
    "driveFileId" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Routine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timeSlot" TEXT NOT NULL DEFAULT 'morning',
    "targetTime" TEXT,
    "daysOfWeek" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedDate" TEXT,
    "reminderMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RoutineLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoutineLog_routineId_date_key" ON "RoutineLog"("routineId", "date");

CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "category" TEXT NOT NULL DEFAULT 'General',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "remindBeforeMinutes" INTEGER NOT NULL DEFAULT 15,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "repeatFrequency" TEXT,
    "repeatInterval" INTEGER NOT NULL DEFAULT 1,
    "repeatDaysOfWeek" TEXT,
    "repeatTime" TEXT,
    "repeatDayOfMonth" INTEGER,
    "repeatMonthOfYear" INTEGER,
    "repeatEndType" TEXT,
    "repeatCount" INTEGER,
    "completedOccurrences" INTEGER NOT NULL DEFAULT 0,
    "repeatUntil" DATETIME,
    "lastTriggeredDate" TEXT,
    "lastCompletedDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CategoryOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryOption_userId_group_name_key" ON "CategoryOption"("userId", "group", "name");

CREATE TABLE IF NOT EXISTS "DailyTracker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Meals & Food',
    "unitName" TEXT NOT NULL DEFAULT 'meals',
    "defaultTarget" REAL NOT NULL DEFAULT 2,
    "unitPrice" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "color" TEXT DEFAULT 'emerald',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DailyTrackerLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "value" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'LOGGED',
    "unitPrice" REAL,
    "notes" TEXT,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" DATETIME,
    "settlementTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("trackerId") REFERENCES "DailyTracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyTrackerLog_trackerId_date_key" ON "DailyTrackerLog"("trackerId", "date");

CREATE TABLE IF NOT EXISTS "DebtLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "description" TEXT,
    "initialTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DebtLoan_userId_type_idx" ON "DebtLoan"("userId", "type");
CREATE INDEX IF NOT EXISTS "DebtLoan_userId_status_idx" ON "DebtLoan"("userId", "status");
CREATE INDEX IF NOT EXISTS "DebtLoan_userId_date_idx" ON "DebtLoan"("userId", "date");

CREATE TABLE IF NOT EXISTS "DebtLoanRepayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debtLoanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Cash',
    "notes" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("debtLoanId") REFERENCES "DebtLoan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DebtLoanRepayment_debtLoanId_idx" ON "DebtLoanRepayment"("debtLoanId");
CREATE INDEX IF NOT EXISTS "DebtLoanRepayment_userId_date_idx" ON "DebtLoanRepayment"("userId", "date");
`;

export function getDatabasePath(): string {
	let baseDir: string;
	if (app && typeof app.getPath === "function") {
		baseDir = app.getPath("userData");
	} else if (process.env.APPDATA) {
		baseDir = path.join(process.env.APPDATA, "desktop-app");
	} else {
		baseDir = path.join(process.cwd(), ".data");
	}

	if (!fs.existsSync(baseDir)) {
		fs.mkdirSync(baseDir, { recursive: true });
	}
	const targetPath = path.join(baseDir, "daypulse.db");

	// Auto-migrate from server dev.db if target does not exist yet
	if (!fs.existsSync(targetPath)) {
		const devDbCandidates = [
			path.resolve(__dirname, "../../../server/prisma/dev.db"),
			path.resolve(process.cwd(), "server/prisma/dev.db"),
			path.resolve(process.cwd(), "../server/prisma/dev.db"),
		];
		for (const candidate of devDbCandidates) {
			if (fs.existsSync(candidate)) {
				try {
					fs.copyFileSync(candidate, targetPath);
					console.log(`[DayPulse Database] Migrated seed database from: ${candidate}`);
					break;
				} catch (err) {
					console.warn("[DayPulse Database] Failed to copy dev.db candidate:", err);
				}
			}
		}
	}

	return targetPath;
}

export function getDatabaseDirectory(): string {
	return path.dirname(getDatabasePath());
}

export function getCurrentUserId(): string | null {
	return getActiveUserId();
}

const LEGACY_PLACEHOLDER_USER_ID = "local_user_default";

/**
 * Earlier builds auto-created a placeholder account on first launch. Remove it
 * when it owns no data so fresh installs land on onboarding instead.
 */
async function removeEmptyPlaceholderUser(db: PrismaClient): Promise<void> {
	const placeholder = await db.user.findUnique({
		where: { id: LEGACY_PLACEHOLDER_USER_ID },
	});
	if (!placeholder) return;

	const where = { userId: LEGACY_PLACEHOLDER_USER_ID };
	const counts = await Promise.all([
		db.task.count({ where }),
		db.routine.count({ where }),
		db.transaction.count({ where }),
		db.dailyTracker.count({ where }),
		db.categoryOption.count({ where }),
	]);
	if (counts.every((count) => count === 0)) {
		await db.user.delete({ where: { id: LEGACY_PLACEHOLDER_USER_ID } });
		console.log("[DayPulse Database] Removed empty legacy placeholder profile");
	}
}

export async function initPrismaDatabase(): Promise<PrismaClient> {
	if (prismaInstance) return prismaInstance;

	const dbPath = getDatabasePath();
	console.log(`[DayPulse Database] Initializing local SQLite at: ${dbPath}`);
	configureSessionStore(path.dirname(dbPath));

	prismaInstance = new PrismaClient({
		datasources: {
			db: {
				url: `file:${dbPath}`,
			},
		},
	});

	const statements = SCHEMA_DDL.split(";")
		.map((s) => s.trim())
		.filter(Boolean);

	for (const stmt of statements) {
		try {
			await prismaInstance.$executeRawUnsafe(stmt);
		} catch (err) {
			console.warn("[DayPulse Database] DDL execution notice:", err);
		}
	}

	try {
		await removeEmptyPlaceholderUser(prismaInstance);
	} catch (err) {
		console.warn("[DayPulse Database] Placeholder cleanup notice:", err);
	}

	const persistedUserId = readPersistedSessionUserId();
	const sessionUser = persistedUserId
		? await prismaInstance.user.findUnique({ where: { id: persistedUserId } })
		: null;

	if (sessionUser) {
		restoreSession(sessionUser.id);
		console.log(`[DayPulse Database] Restored session: ${sessionUser.email} (${sessionUser.id})`);
	} else {
		restoreSession(null);
		const accountCount = await prismaInstance.user.count();
		console.log(`[DayPulse Database] No active session (${accountCount} local account(s))`);
	}

	return prismaInstance;
}

export function getPrismaClient(): PrismaClient {
	if (!prismaInstance) {
		throw new Error("Local Prisma database has not been initialized yet");
	}
	return prismaInstance;
}

export async function closePrismaDatabase(): Promise<void> {
	if (prismaInstance) {
		await prismaInstance.$disconnect();
		prismaInstance = null;
	}
}
