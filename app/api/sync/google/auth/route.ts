import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/jwt-auth";
import { isGoogleConfigured, getGoogleAuthUrl } from "@/lib/google-drive";
import { sendApiResponse } from "@/lib/send-response";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return sendApiResponse({
        statusCode: 401,
        success: false,
        message: "Unauthorized. Please log in first.",
      });
    }

    if (!isGoogleConfigured()) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: "Google OAuth credentials (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET) are not configured in your .env file.",
      });
    }

    const authUrl = getGoogleAuthUrl(auth.userId);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
