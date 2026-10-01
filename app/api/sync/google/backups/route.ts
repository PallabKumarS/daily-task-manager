import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/jwt-auth";
import { sendApiResponse } from "@/lib/send-response";
import { getValidGoogleAccessToken } from "@/lib/google-user-token";
import { listGoogleDriveBackups } from "@/lib/google-drive";

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

    const accessToken = await getValidGoogleAccessToken(auth.userId);
    if (!accessToken) {
      return sendApiResponse({
        statusCode: 400,
        success: false,
        message: "Google Account is not connected.",
      });
    }

    const files = await listGoogleDriveBackups(accessToken);

    return sendApiResponse({
      statusCode: 200,
      success: true,
      data: files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error listing backups";
    return sendApiResponse({
      statusCode: 500,
      success: false,
      message,
    });
  }
}
