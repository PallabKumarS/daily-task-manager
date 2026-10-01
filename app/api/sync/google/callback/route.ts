import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, getGoogleProfile } from "@/lib/google-drive";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateUserId = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code || !stateUserId) {
    const errorMsg = error || "Missing code or state parameter";
    return NextResponse.redirect(`${appUrl}/settings?sync_error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getGoogleProfile(tokens.accessToken);

    const expiryDate = new Date(Date.now() + tokens.expiresIn * 1000);

    await prisma.user.update({
      where: { id: stateUserId },
      data: {
        googleId: profile.id,
        googleEmail: profile.email,
        googleAccessToken: tokens.accessToken,
        ...(tokens.refreshToken && { googleRefreshToken: tokens.refreshToken }),
        googleTokenExpiry: expiryDate,
      },
    });

    return NextResponse.redirect(`${appUrl}/settings?sync_status=connected&email=${encodeURIComponent(profile.email)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange error";
    return NextResponse.redirect(`${appUrl}/settings?sync_error=${encodeURIComponent(msg)}`);
  }
}
