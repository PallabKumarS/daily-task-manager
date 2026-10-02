import config from "../config/index.js";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    config.google.clientId &&
    config.google.clientSecret &&
    config.google.clientId !== "your-google-client-id-here"
  );
}

export function getGoogleAuthUrl(userId: string): string {
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed: ${errorText}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google token: ${errorText}`);
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
  };
}

export async function getGoogleProfile(
  accessToken: string
): Promise<{ id: string; email: string; name?: string }> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google profile");
  }

  return (await response.json()) as { id: string; email: string; name?: string };
}

export async function uploadBackupToGoogleDrive(
  accessToken: string,
  backupData: unknown,
  fileName = "DayPulse_Backup.json",
  targetFileId?: string | null
): Promise<GoogleDriveFile> {
  const fileContent = JSON.stringify(backupData, null, 2);
  let resolvedFileId = targetFileId;

  if (!resolvedFileId) {
    const searchParams = new URLSearchParams({
      q: `name = '${fileName}' and trashed = false`,
      fields: "files(id, name, modifiedTime, size)",
    });

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (searchRes.ok) {
      const searchJson = (await searchRes.json()) as { files?: Array<{ id: string }> };
      if (searchJson.files && searchJson.files.length > 0) {
        resolvedFileId = searchJson.files[0].id;
      }
    }
  }

  // Update existing file content directly without duplicating
  if (resolvedFileId) {
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${resolvedFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: fileContent,
      }
    );

    if (updateRes.ok) {
      const updated = (await updateRes.json()) as { id: string };
      return {
        id: updated.id || resolvedFileId,
        name: fileName,
        modifiedTime: new Date().toISOString(),
      };
    }
  }

  // Create new multipart file if no previous file existed
  const boundary = `-------314159265358979323846`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: "application/json",
    description: "DayPulse daily tasks, routines, and wealth tracking backup archive",
  };

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    fileContent +
    closeDelimiter;

  const createRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create file in Google Drive: ${err}`);
  }

  const created = (await createRes.json()) as { id: string };
  return {
    id: created.id,
    name: fileName,
    modifiedTime: new Date().toISOString(),
  };
}

export async function listGoogleDriveBackups(accessToken: string): Promise<GoogleDriveFile[]> {
  const query = "name contains 'DayPulse' and trashed = false";
  const params = new URLSearchParams({
    q: query,
    fields: "files(id, name, size, modifiedTime, createdTime)",
    orderBy: "modifiedTime desc",
    pageSize: "15",
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list backups from Google Drive: ${err}`);
  }

  const json = (await res.json()) as { files?: GoogleDriveFile[] };
  return json.files || [];
}

export async function downloadBackupFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<unknown> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to download backup from Google Drive: ${err}`);
  }

  return res.json();
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {
    // ignore
  }
}
