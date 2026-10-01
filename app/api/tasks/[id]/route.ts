import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(["TASK", "EVENT"]).optional(),
  category: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  remindBeforeMinutes: z.number().int().min(0).optional(),
});

export async function PATCH(
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
    const body = await req.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const existing = await prisma.task.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "Task or Event not found",
      });
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startDate !== undefined) {
      updateData.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    }
    if (parsed.data.dueDate !== undefined) {
      updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }
    if (parsed.data.status === "COMPLETED" && existing.status !== "COMPLETED") {
      updateData.completedAt = new Date();
    } else if (parsed.data.status && parsed.data.status !== "COMPLETED") {
      updateData.completedAt = null;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Updated successfully",
      data: updated,
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

export async function DELETE(
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
    const existing = await prisma.task.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "Task or Event not found",
      });
    }

    await prisma.task.delete({
      where: { id },
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Deleted successfully",
      data: null,
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
