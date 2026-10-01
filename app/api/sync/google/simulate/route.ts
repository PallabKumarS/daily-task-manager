import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import fs from "fs/promises";
import path from "path";

const SIMULATED_DRIVE_DIR = path.join(process.cwd(), "prisma", "simulated-google-drive");

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

    const { action, fileId } = await req.json().catch(() => ({ action: "upload" }));

    await fs.mkdir(SIMULATED_DRIVE_DIR, { recursive: true });

    if (action === "upload") {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, name: true, email: true, currency: true },
      });

      const routines = await prisma.routine.findMany({
        where: { userId: auth.userId },
        include: { logs: true },
      });

      const tasks = await prisma.task.findMany({
        where: { userId: auth.userId },
      });

      const transactions = await prisma.transaction.findMany({
        where: { userId: auth.userId },
      });

      const backupPayload = {
        app: "DayPulse",
        version: "1.0.0",
        syncedAt: new Date().toISOString(),
        cloudProvider: "Google Drive (Simulated Sandbox)",
        user,
        routines,
        tasks,
        transactions,
      };

      const filename = `DayPulse_Backup_${auth.userId}.json`;
      const filePath = path.join(SIMULATED_DRIVE_DIR, filename);
      await fs.writeFile(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");

      const now = new Date();
      await prisma.user.update({
        where: { id: auth.userId },
        data: {
          lastGoogleSyncAt: now,
          googleEmail: "test.google.user@gmail.com",
        },
      });

      return sendApiResponse({
        statusCode: 200,
        success: true,
        message: "Simulated Google Drive Sync completed successfully!",
        data: {
          simulated: true,
          fileName: filename,
          fileId: "simulated_drive_file_" + Date.now(),
          lastGoogleSyncAt: now.toISOString(),
          routinesCount: routines.length,
          tasksCount: tasks.length,
          transactionsCount: transactions.length,
          cloudPath: filePath,
        },
      });
    }

    if (action === "restore") {
      const filename = `DayPulse_Backup_${auth.userId}.json`;
      const filePath = path.join(SIMULATED_DRIVE_DIR, filename);

      try {
        const content = await fs.readFile(filePath, "utf-8");
        const downloaded = JSON.parse(content);

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
          message: `Simulated Drive Restore: Imported ${importedRoutines} routines, ${importedTasks} tasks, and ${importedTransactions} transactions!`,
          data: {
            simulated: true,
            importedRoutines,
            importedTasks,
            importedTransactions,
          },
        });
      } catch {
        return sendApiResponse({
          statusCode: 404,
          success: false,
          message: "No simulated Google Drive backup found yet. Run backup first.",
        });
      }
    }

    return sendApiResponse({
      statusCode: 400,
      success: false,
      message: "Unknown simulation action",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation error";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
