import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return sendApiResponse({
        statusCode: 401,
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        currency: true,
        createdAt: true,
      },
    });

    if (!user) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "User not found",
      });
    }

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
      exportedAt: new Date().toISOString(),
      user,
      routines,
      tasks,
      transactions,
    };

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Backup generated successfully",
      data: backupPayload,
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
