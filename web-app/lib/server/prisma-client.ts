import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
	configureSessionStore,
	getActiveUserId,
	readPersistedSessionUserId,
	restoreSession,
} from "./session-store";

let prismaInstance: PrismaClient | null = null;
let initPromise: Promise<PrismaClient> | null = null;

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
	if (process.env.DATABASE_URL?.startsWith("file:")) {
		return process.env.DATABASE_URL.replace(/^file:/, "");
	}

	let baseDir: string;
	if (process.env.USER_DATA_PATH) {
		baseDir = process.env.USER_DATA_PATH;
	} else if (process.env.APPDATA) {
		baseDir = path.join(process.env.APPDATA, "DayPulse");
	} else {
		baseDir = path.join(process.cwd(), ".data");
	}

	if (!fs.existsSync(baseDir)) {
		fs.mkdirSync(baseDir, { recursive: true });
	}
	const targetPath = path.join(baseDir, "daypulse.db");

	if (!fs.existsSync(targetPath)) {
		const devDbCandidates = [
			path.resolve(process.cwd(), "prisma/dev.db"),
			path.resolve(process.cwd(), "../server/prisma/dev.db"),
			path.resolve(process.cwd(), "../../server/prisma/dev.db"),
		];
		for (const candidate of devDbCandidates) {
			if (fs.existsSync(candidate)) {
				try {
					fs.copyFileSync(candidate, targetPath);
					break;
				} catch {}
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
	}
}

export async function initPrismaDatabase(): Promise<PrismaClient> {
	if (prismaInstance) return prismaInstance;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const dbPath = getDatabasePath();
		configureSessionStore(path.dirname(dbPath));

		const client = new PrismaClient({
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
				await client.$executeRawUnsafe(stmt);
			} catch {}
		}

		try {
			await removeEmptyPlaceholderUser(client);
		} catch {}

		const persistedUserId = readPersistedSessionUserId();
		const sessionUser = persistedUserId
			? await client.user.findUnique({ where: { id: persistedUserId } })
			: null;

		if (sessionUser) {
			restoreSession(sessionUser.id);
		} else {
			restoreSession(null);
		}

		prismaInstance = client;
		return client;
	})();

	return initPromise;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
	if (prismaInstance) return prismaInstance;
	if (globalForPrisma.prisma) {
		prismaInstance = globalForPrisma.prisma;
		return prismaInstance;
	}

	const dbPath = getDatabasePath();
	configureSessionStore(path.dirname(dbPath));

	prismaInstance = new PrismaClient({
		datasources: {
			db: {
				url: `file:${dbPath}`,
			},
		},
	});
	globalForPrisma.prisma = prismaInstance;

	// Run background DDL migrations and session restore safely
	initPrismaDatabase().catch(() => {});

	return prismaInstance;
}

export async function closePrismaDatabase(): Promise<void> {
	if (prismaInstance) {
		await prismaInstance.$disconnect();
		prismaInstance = null;
		globalForPrisma.prisma = undefined;
	}
}
