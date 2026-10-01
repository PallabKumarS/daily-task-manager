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
    const type = searchParams.get("type"); // EXPENSE, INCOME, or all
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Number(searchParams.get("limit")) || 50;

    const where: Record<string, unknown> = {
      userId: auth.userId,
    };

    if (type && ["EXPENSE", "INCOME"].includes(type.toUpperCase())) {
      where.type = type.toUpperCase();
    }

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      data: transactions,
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

const createTransactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  paymentMethod: z.string().default("Cash"),
  date: z.string().optional(),
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
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: auth.userId,
        type: parsed.data.type,
        amount: parsed.data.amount,
        category: parsed.data.category,
        description: parsed.data.description || null,
        paymentMethod: parsed.data.paymentMethod,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      },
    });

    return sendApiResponse({
      statusCode: 201,
      success: true,
      message: `${parsed.data.type === "INCOME" ? "Income" : "Expense"} logged successfully`,
      data: transaction,
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
