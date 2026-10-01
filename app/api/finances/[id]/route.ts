import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";

const updateTransactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]).optional(),
  amount: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  paymentMethod: z.string().optional(),
  date: z.string().optional(),
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
    const parsed = updateTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "Transaction not found",
      });
    }

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.date) {
      updateData.date = new Date(parsed.data.date);
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Transaction updated successfully",
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
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return sendApiResponse({
        statusCode: 404,
        success: false,
        message: "Transaction not found",
      });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Transaction deleted successfully",
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
