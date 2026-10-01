import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { getValidGoogleAccessToken } from "@/lib/google-user-token";
import { uploadBackupToGoogleDrive } from "@/lib/google-drive";

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
        message: "Google Account is not connected or token expired. Please connect your Google account in Settings.",
      });
    }

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
      user,
      routines,
      tasks,
      transactions,
    };

    const uploadedFile = await uploadBackupToGoogleDrive(accessToken, backupPayload, "DayPulse_Backup.json");

    const now = new Date();
    await prisma.user.update({
      where: { id: auth.userId },
      data: { lastGoogleSyncAt: now },
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Successfully synchronized and backed up to Google Drive!",
      data: {
        file: uploadedFile,
        lastGoogleSyncAt: now.toISOString(),
        routinesCount: routines.length,
        tasksCount: tasks.length,
        transactionsCount: transactions.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync error";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
