import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { getValidGoogleAccessToken } from "@/lib/google-user-token";
import { downloadBackupFromGoogleDrive, listGoogleDriveBackups } from "@/lib/google-drive";

interface BackupPayload {
  routines?: Array<{
    title: string;
    description?: string | null;
    timeSlot?: string;
    targetTime?: string | null;
    daysOfWeek?: string;
    reminderMinutes?: number;
  }>;
  tasks?: Array<{
    title: string;
    description?: string | null;
    type?: string;
    category?: string;
    priority?: string;
    status?: string;
    startDate?: string | null;
    dueDate?: string | null;
    remindBeforeMinutes?: number;
  }>;
  transactions?: Array<{
    type: "EXPENSE" | "INCOME";
    amount: number;
    category: string;
    description?: string | null;
    paymentMethod?: string;
    date: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return sendApiResponse({
        statusCode: 401,
        success: false,
        message: "Unauthorized",
      });
    }

    const accessToken = await getValidGoogleAccessToken(auth.userId);
    if (!accessToken) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: "Google Account is not connected.",
      });
    }

    const body = await req.json().catch(() => ({}));
    let fileId = body.fileId;

    if (!fileId) {
      const files = await listGoogleDriveBackups(accessToken);
      if (files.length === 0) {
        return sendApiResponse({
          statusCode: 404,
          success: false,
          message: "No DayPulse backup found on your Google Drive.",
        });
      }
      fileId = files[0].id;
    }

    const downloaded = (await downloadBackupFromGoogleDrive(accessToken, fileId)) as BackupPayload;

    if (!downloaded || typeof downloaded !== "object") {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: "Invalid backup data retrieved from Google Drive.",
      });
    }

    let importedRoutines = 0;
    let importedTasks = 0;
    let importedTransactions = 0;

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(downloaded.routines)) {
        for (const r of downloaded.routines) {
          if (r.title) {
            await tx.routine.create({
              data: {
                userId: auth.userId,
                title: r.title,
                description: r.description || null,
                timeSlot: r.timeSlot || "morning",
                targetTime: r.targetTime || null,
                daysOfWeek: r.daysOfWeek || "0,1,2,3,4,5,6",
                reminderMinutes: r.reminderMinutes || 0,
              },
            });
            importedRoutines++;
          }
        }
      }

      if (Array.isArray(downloaded.tasks)) {
        for (const t of downloaded.tasks) {
          if (t.title) {
            await tx.task.create({
              data: {
                userId: auth.userId,
                title: t.title,
                description: t.description || null,
                type: t.type || "TASK",
                category: t.category || "General",
                priority: t.priority || "MEDIUM",
                status: t.status || "PENDING",
                startDate: t.startDate ? new Date(t.startDate) : null,
                dueDate: t.dueDate ? new Date(t.dueDate) : null,
                remindBeforeMinutes: t.remindBeforeMinutes ?? 15,
              },
            });
            importedTasks++;
          }
        }
      }

      if (Array.isArray(downloaded.transactions)) {
        for (const tr of downloaded.transactions) {
          if (tr.type && tr.amount && tr.category) {
            await tx.transaction.create({
              data: {
                userId: auth.userId,
                type: tr.type,
                amount: Number(tr.amount),
                category: tr.category,
                description: tr.description || null,
                paymentMethod: tr.paymentMethod || "Cash",
                date: tr.date ? new Date(tr.date) : new Date(),
              },
            });
            importedTransactions++;
          }
        }
      }
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: `Restored ${importedRoutines} routines, ${importedTasks} tasks/events, and ${importedTransactions} transactions from Google Drive!`,
      data: {
        importedRoutines,
        importedTasks,
        importedTransactions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error restoring from Drive";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
