import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { getTodayDateString } from "@/lib/date-helpers";

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

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getTodayDateString();

    const routines = await prisma.routine.findMany({
      where: { userId: auth.userId },
      include: {
        logs: {
          where: { date },
          select: { id: true, date: true, completed: true, completedAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = routines.map((r) => {
      const isCompletedToday = r.logs.length > 0 && r.logs[0].completed;
      return {
        ...r,
        isCompletedToday,
        todayLog: r.logs[0] || null,
      };
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      data: formatted,
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

const createRoutineSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  timeSlot: z.enum(["morning", "afternoon", "evening", "night", "anytime"]).default("morning"),
  targetTime: z.string().optional().nullable(),
  daysOfWeek: z.string().default("0,1,2,3,4,5,6"),
  reminderMinutes: z.number().int().min(0).default(0),
});

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

    const body = await req.json();
    const parsed = createRoutineSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const routine = await prisma.routine.create({
      data: {
        userId: auth.userId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        timeSlot: parsed.data.timeSlot,
        targetTime: parsed.data.targetTime || null,
        daysOfWeek: parsed.data.daysOfWeek,
        reminderMinutes: parsed.data.reminderMinutes,
      },
    });

    return sendApiResponse({
      statusCode: 201,
      success: true,
      message: "Routine created successfully",
      data: {
        ...routine,
        isCompletedToday: false,
        todayLog: null,
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
