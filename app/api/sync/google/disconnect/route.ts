import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { revokeGoogleToken } from "@/lib/google-drive";

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

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { googleAccessToken: true },
    });

    if (user?.googleAccessToken) {
      await revokeGoogleToken(user.googleAccessToken).catch(() => {});
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: {
        googleId: null,
        googleEmail: null,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
      },
    });

    return sendApiResponse({
      statusCode: 200,
      success: true,
      message: "Disconnected Google Account",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error disconnecting";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
