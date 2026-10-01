import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";

const updateRoutineSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  timeSlot: z.enum(["morning", "afternoon", "evening", "night", "anytime"]).optional(),
  targetTime: z.string().nullable().optional(),
  daysOfWeek: z.string().optional(),
  reminderMinutes: z.number().int().min(0).optional(),
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
    const parsed = updateRoutineSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const existing = await prisma.routine.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "Routine not found",
      });
    }

    const updated = await prisma.routine.update({
      where: { id },
      data: parsed.data,
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Routine updated successfully",
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
    const existing = await prisma.routine.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "Routine not found",
      });
    }

    await prisma.routine.delete({
      where: { id },
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Routine deleted successfully",
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
