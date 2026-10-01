import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";

interface BackupPayload {
  app?: string;
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

    const payload: BackupPayload = await req.json();

    if (!payload || typeof payload !== "object") {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: "Invalid backup format",
      });
    }

    let importedRoutinesCount = 0;
    let importedTasksCount = 0;
    let importedTransactionsCount = 0;

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(payload.routines)) {
        for (const r of payload.routines) {
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
            importedRoutinesCount++;
          }
        }
      }

      if (Array.isArray(payload.tasks)) {
        for (const t of payload.tasks) {
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
            importedTasksCount++;
          }
        }
      }

      if (Array.isArray(payload.transactions)) {
        for (const tr of payload.transactions) {
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
            importedTransactionsCount++;
          }
        }
      }
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: `Restored ${importedRoutinesCount} routines, ${importedTasksCount} tasks/events, and ${importedTransactionsCount} transactions`,
      data: {
        importedRoutinesCount,
        importedTasksCount,
        importedTransactionsCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
