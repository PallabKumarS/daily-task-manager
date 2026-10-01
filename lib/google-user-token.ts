import { prisma } from "@/lib/prisma";
import { refreshGoogleAccessToken } from "@/lib/google-drive";

export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user || !user.googleAccessToken) {
    return null;
  }

  const now = new Date();
  const isExpired = user.googleTokenExpiry ? user.googleTokenExpiry.getTime() <= now.getTime() + 60000 : false;

  if (!isExpired) {
    return user.googleAccessToken;
  }

  if (!user.googleRefreshToken) {
    return user.googleAccessToken;
  }

  try {
    const refreshed = await refreshGoogleAccessToken(user.googleRefreshToken);
    const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: refreshed.accessToken,
        googleTokenExpiry: newExpiry,
      },
    });

    return refreshed.accessToken;
  } catch {
    return null;
  }
}
