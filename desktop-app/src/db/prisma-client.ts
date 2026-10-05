import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import { app } from "electron";

let prismaInstance: PrismaClient | null = null;
let currentUserId = "local_user_default";

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
					console.log(
						`[DayPulse Database] Migrated seed database from: ${candidate}`,
					);
					break;
				} catch (err) {
					console.warn(
						"[DayPulse Database] Failed to copy dev.db candidate:",
						err,
					);
				}
			}
		}
	}

	return targetPath;
}

export function getCurrentUserId(): string {
	return currentUserId;
}

export function setCurrentUserId(userId: string): void {
	currentUserId = userId;
}

export async function initPrismaDatabase(): Promise<PrismaClient> {
	if (prismaInstance) return prismaInstance;

	const dbPath = getDatabasePath();
	console.log(`[DayPulse Database] Initializing local SQLite at: ${dbPath}`);

	prismaInstance = new PrismaClient({
		datasources: {
			db: {
				url: `file:${dbPath}`,
			},
		},
	});

	// Execute DDL schema to ensure tables and indexes exist
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

	// Prioritize primary user if available, otherwise any registered user
	const existingUser =
		(await prismaInstance.user.findFirst({
			where: { email: "pallabkumar26@gmail.com" },
		})) ||
		(await prismaInstance.user.findFirst({
			where: { email: { not: "local@daypulse.app" } },
			orderBy: { createdAt: "desc" },
		})) ||
		(await prismaInstance.user.findFirst());

	if (!existingUser) {
		const defaultUser = await prismaInstance.user.create({
			data: {
				id: "local_user_default",
				email: "local@daypulse.app",
				name: "Local User",
				passwordHash: "local_standalone_session",
				currency: "USD",
			},
		});
		currentUserId = defaultUser.id;
		console.log(
			`[DayPulse Database] Seeded default local profile: ${defaultUser.id}`,
		);
	} else {
		currentUserId = existingUser.id;
		console.log(
			`[DayPulse Database] Active local user: ${existingUser.email} (${existingUser.id})`,
		);
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
