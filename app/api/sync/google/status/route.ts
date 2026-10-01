import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { isGoogleConfigured } from "@/lib/google-drive";

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
        googleId: true,
        googleEmail: true,
        googleAccessToken: true,
        lastGoogleSyncAt: true,
      },
    });

    const isConfigured = isGoogleConfigured();
    const isConnected = Boolean(user?.googleAccessToken && user?.googleEmail);

    return sendApiResponse({
      statusCode: 200,
      success: true,
      data: {
        configured: isConfigured,
        connected: isConnected,
        googleEmail: user?.googleEmail || null,
        lastGoogleSyncAt: user?.lastGoogleSyncAt || null,
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
