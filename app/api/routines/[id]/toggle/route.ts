import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { calculateNewStreak, getTodayDateString } from "@/lib/date-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return sendApiResponse({
        statusCode: 401,
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const date = body.date || getTodayDateString();

    const routine = await prisma.routine.findFirst({
      where: { id, userId: auth.userId },
      include: {
        logs: {
          where: { date },
        },
      },
    });

    if (!routine) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "Routine not found",
      });
    }

    const currentLog = routine.logs[0] || null;
    const isCurrentlyCompleted = currentLog?.completed ?? false;
    const willBeCompleted = !isCurrentlyCompleted;

    if (willBeCompleted) {
      const newStreak = calculateNewStreak(routine.lastCompletedDate, date, routine.streakCount);

      const [log, updatedRoutine] = await prisma.$transaction([
        prisma.routineLog.upsert({
          where: {
            routineId_date: {
              routineId: id,
              date,
            },
          },
          create: {
            routineId: id,
            userId: auth.userId,
            date,
            completed: true,
          },
          update: {
            completed: true,
            completedAt: new Date(),
          },
        }),
        prisma.routine.update({
          where: { id },
          data: {
            streakCount: newStreak,
            lastCompletedDate: date,
          },
        }),
      ]);

      return sendApiResponse({
        statusCode: 200,
        success: true,
        message: "Routine marked as completed",
        data: {
          routine: updatedRoutine,
          log,
          isCompletedToday: true,
        },
      });
    }

    const newStreak = Math.max(0, routine.streakCount - 1);
    const [log, updatedRoutine] = await prisma.$transaction([
      prisma.routineLog.upsert({
        where: {
          routineId_date: {
            routineId: id,
            date,
          },
        },
        create: {
          routineId: id,
          userId: auth.userId,
          date,
          completed: false,
        },
        update: {
          completed: false,
        },
      }),
      prisma.routine.update({
        where: { id },
        data: {
          streakCount: newStreak,
        },
      }),
    ]);

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Routine marked as incomplete",
      data: {
        routine: updatedRoutine,
        log,
        isCompletedToday: false,
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
