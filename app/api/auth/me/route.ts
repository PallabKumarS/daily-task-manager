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

    return sendApiResponse({
      statusCode: 200,
      success: true,
      data: user,
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

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  currency: z.string().min(1).max(5).optional(),
});

export async function PATCH(req: NextRequest) {
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
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: parsed.error.issues[0]?.message || "Validation failed",
      });
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.currency && { currency: parsed.data.currency.toUpperCase() }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        currency: true,
        createdAt: true,
      },
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Profile updated successfully",
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
