import { NextRequest } from "next/server";
import { z } from "zod";
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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // TASK, EVENT, or null
    const status = searchParams.get("status"); // PENDING, COMPLETED, etc.
    const priority = searchParams.get("priority");
    const upcoming = searchParams.get("upcoming"); // true = due today or later

    const where: Record<string, unknown> = {
      userId: auth.userId,
    };

    if (type && ["TASK", "EVENT"].includes(type.toUpperCase())) {
      where.type = type.toUpperCase();
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    if (priority) {
      where.priority = priority.toUpperCase();
    }

    if (upcoming === "true") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      where.dueDate = {
        gte: startOfToday,
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      data: tasks,
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

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  type: z.enum(["TASK", "EVENT"]).default("TASK"),
  category: z.string().default("General"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("PENDING"),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  remindBeforeMinutes: z.number().int().min(0).default(15),
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
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const task = await prisma.task.create({
      data: {
        userId: auth.userId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        type: parsed.data.type,
        category: parsed.data.category,
        priority: parsed.data.priority,
        status: parsed.data.status,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        remindBeforeMinutes: parsed.data.remindBeforeMinutes,
      },
    });

    return sendApiResponse({
      statusCode: 201,
      success: true,
      message: `${parsed.data.type === "EVENT" ? "Event" : "Task"} created successfully`,
      data: task,
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
