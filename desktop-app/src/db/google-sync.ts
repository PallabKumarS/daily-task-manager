import * as http from "node:http";
import type { PrismaClient } from "@prisma/client";
import { createBackupArchive } from "./archive-builder.js";
import { restoreBackupArchive } from "./archive-extractor.js";

const GOOGLE_CLIENT_ID =
	process.env.GOOGLE_CLIENT_ID ||
	"your-client-id.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET =
	process.env.GOOGLE_CLIENT_SECRET || "GOCSPX-REDACTED";
const GOOGLE_REDIRECT_URI =
	process.env.GOOGLE_REDIRECT_URI ||
	"http://localhost:5000/api/v1/sync/google/callback";

let loopbackServer: http.Server | null = null;

export interface GoogleTokens {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
}

export interface GoogleProfile {
	id: string;
	email: string;
	name?: string;
}

export function isGoogleConfigured(): boolean {
	return Boolean(
		GOOGLE_CLIENT_ID &&
			GOOGLE_CLIENT_SECRET &&
			GOOGLE_CLIENT_ID !== "your-google-client-id-here",
	);
}

export function getGoogleAuthUrl(userId: string): string {
	const scopes = [
		"https://www.googleapis.com/auth/drive.file",
		"https://www.googleapis.com/auth/userinfo.email",
		"https://www.googleapis.com/auth/userinfo.profile",
	].join(" ");

	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: GOOGLE_REDIRECT_URI,
		response_type: "code",
		scope: scopes,
		access_type: "offline",
		prompt: "consent",
		state: userId,
	});

	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
	code: string,
): Promise<GoogleTokens> {
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: GOOGLE_CLIENT_ID,
			client_secret: GOOGLE_CLIENT_SECRET,
			redirect_uri: GOOGLE_REDIRECT_URI,
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

export async function getGoogleProfile(
	accessToken: string,
): Promise<GoogleProfile> {
	const response = await fetch(
		"https://www.googleapis.com/oauth2/v2/userinfo",
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!response.ok) {
		throw new Error("Failed to fetch Google profile");
	}

	return (await response.json()) as GoogleProfile;
}

export async function refreshGoogleAccessToken(
	refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			refresh_token: refreshToken,
			client_id: GOOGLE_CLIENT_ID,
			client_secret: GOOGLE_CLIENT_SECRET,
			grant_type: "refresh_token",
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to refresh Google token: ${errorText}`);
	}

	const json = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};
	return {
		accessToken: json.access_token,
		expiresIn: json.expires_in,
	};
}

export async function getValidAccessToken(
	prisma: PrismaClient,
	userId: string,
): Promise<string> {
	const connection = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	if (!connection) {
		throw new Error("Google Drive is not connected for this account.");
	}

	const now = new Date();
	const expiry = connection.tokenExpiry
		? new Date(connection.tokenExpiry)
		: null;
	const isExpiringSoon = expiry
		? expiry.getTime() - now.getTime() < 5 * 60 * 1000
		: false;

	if (isExpiringSoon && connection.encryptedRefresh) {
		try {
			const refreshed = await refreshGoogleAccessToken(
				connection.encryptedRefresh,
			);
			const tokenExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);

			await prisma.googleConnection.update({
				where: { userId },
				data: {
					encryptedAccess: refreshed.accessToken,
					tokenExpiry,
				},
			});

			return refreshed.accessToken;
		} catch {
			return connection.encryptedAccess;
		}
	}

	return connection.encryptedAccess;
}

export async function uploadBackupToGoogleDrive(
	accessToken: string,
	backupData: unknown,
	fileName = "DayPulse_Backup.json",
): Promise<{ id: string; name: string; modifiedTime: string }> {
	const fileContent = JSON.stringify(backupData, null, 2);

	const searchParams = new URLSearchParams({
		q: `name = '${fileName}' and trashed = false`,
		fields: "files(id, name, modifiedTime)",
	});

	const searchRes = await fetch(
		`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	let existingFileId: string | null = null;
	if (searchRes.ok) {
		const searchJson = (await searchRes.json()) as {
			files?: Array<{ id: string }>;
		};
		if (searchJson.files && searchJson.files.length > 0) {
			existingFileId = searchJson.files[0].id;
		}
	}

	if (existingFileId) {
		const updateRes = await fetch(
			`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: fileContent,
			},
		);

		if (updateRes.ok) {
			const updated = (await updateRes.json()) as { id: string };
			return {
				id: updated.id || existingFileId,
				name: fileName,
				modifiedTime: new Date().toISOString(),
			};
		}
	}

	const boundary = "-------314159265358979323846";
	const delimiter = `\r\n--${boundary}\r\n`;
	const closeDelimiter = `\r\n--${boundary}--`;

	const metadata = {
		name: fileName,
		mimeType: "application/json",
		description: "DayPulse standalone workspace cloud backup",
	};

	const multipartBody =
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
			body: multipartBody,
		},
	);

	if (!createRes.ok) {
		const err = await createRes.text();
		throw new Error(`Failed to upload to Google Drive: ${err}`);
	}

	const created = (await createRes.json()) as { id: string };
	return {
		id: created.id,
		name: fileName,
		modifiedTime: new Date().toISOString(),
	};
}

export async function downloadLatestBackupFromGoogleDrive(
	accessToken: string,
	fileName = "DayPulse_Backup.json",
): Promise<unknown> {
	const searchParams = new URLSearchParams({
		q: `name = '${fileName}' and trashed = false`,
		fields: "files(id, name, modifiedTime)",
		orderBy: "modifiedTime desc",
	});

	const searchRes = await fetch(
		`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (!searchRes.ok) {
		throw new Error("Failed to search Google Drive for backups");
	}

	const searchJson = (await searchRes.json()) as {
		files?: Array<{ id: string }>;
	};
	if (!searchJson.files || searchJson.files.length === 0) {
		throw new Error("No DayPulse backups found on your Google Drive");
	}

	const fileId = searchJson.files[0].id;
	const downloadRes = await fetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (!downloadRes.ok) {
		throw new Error("Failed to download backup content from Google Drive");
	}

	return downloadRes.json();
}

export function startGoogleOAuthLoopbackServer(
	prisma: PrismaClient,
	onConnected?: (email: string) => void,
): void {
	if (loopbackServer) return;

	loopbackServer = http.createServer(async (req, res) => {
		try {
			const reqUrl = new URL(req.url || "/", "http://localhost:5000");
			if (reqUrl.pathname === "/api/v1/sync/google/callback") {
				const code = reqUrl.searchParams.get("code");
				const userId = reqUrl.searchParams.get("state");

				if (!code || !userId) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end("<h2>Authentication error: missing authorization code</h2>");
					return;
				}

				const tokens = await exchangeCodeForTokens(code);
				const profile = await getGoogleProfile(tokens.accessToken);
				const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

				await prisma.googleConnection.upsert({
					where: { userId },
					update: {
						googleId: profile.id,
						googleEmail: profile.email,
						encryptedAccess: tokens.accessToken,
						encryptedRefresh: tokens.refreshToken || undefined,
						tokenExpiry,
					},
					create: {
						userId,
						googleId: profile.id,
						googleEmail: profile.email,
						encryptedAccess: tokens.accessToken,
						encryptedRefresh: tokens.refreshToken || null,
						tokenExpiry,
					},
				});

				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				res.end(`
					<!DOCTYPE html>
					<html>
					<head>
						<meta charset="utf-8">
						<title>Google Connected - DayPulse</title>
						<style>
							body { background: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
							.card { background: #18181b; padding: 48px; border-radius: 20px; border: 1px solid #27272a; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
							h2 { color: #10b981; margin: 0 0 12px; font-size: 22px; }
							p { color: #a1a1aa; font-size: 14px; margin: 8px 0; line-height: 1.5; }
							.badge { display: inline-block; background: rgba(16,185,129,0.1); color: #34d399; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-top: 16px; border: 1px solid rgba(16,185,129,0.2); }
						</style>
					</head>
					<body>
						<div class="card">
							<h2>Google Account Connected</h2>
							<p>Your Google Drive connection is now active in DayPulse (${profile.email}).</p>
							<p>You can close this tab and return to the DayPulse workspace.</p>
							<div class="badge">Connection Active</div>
						</div>
					</body>
					</html>
				`);

				if (onConnected) {
					onConnected(profile.email);
				}
				return;
			}

			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not Found");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			res.writeHead(500, { "Content-Type": "text/html" });
			res.end(`<h2>Connection error: ${msg}</h2>`);
		}
	});

	loopbackServer.listen(5000, "127.0.0.1", () => {
		console.log(
			"[DayPulse Desktop] Google OAuth loopback listener active on port 5000",
		);
	});

	loopbackServer.on("error", (err) => {
		console.warn("[DayPulse Desktop] Loopback listener notice:", err);
	});
}

export async function executeGoogleSyncUpload(
	prisma: PrismaClient,
	userId: string,
): Promise<{ success: boolean; message: string; lastSyncAt: string }> {
	const accessToken = await getValidAccessToken(prisma, userId);
	const archive = await createBackupArchive(userId, prisma);

	const backupPayload = {
		exportedAt: new Date().toISOString(),
		manifest: archive.manifest,
		archiveBase64: archive.base64,
	};

	const uploadResult = await uploadBackupToGoogleDrive(
		accessToken,
		backupPayload,
		"DayPulse_Backup.json",
	);

	const now = new Date();
	await prisma.googleConnection.update({
		where: { userId },
		data: {
			lastSyncAt: now,
			driveFileId: uploadResult.id,
		},
	});

	return {
		success: true,
		message: "Workspace backed up to Google Drive successfully",
		lastSyncAt: now.toISOString(),
	};
}

export async function executeGoogleSyncRestore(
	prisma: PrismaClient,
	userId: string,
): Promise<{ success: boolean; message: string }> {
	const accessToken = await getValidAccessToken(prisma, userId);
	const data = (await downloadLatestBackupFromGoogleDrive(accessToken)) as {
		archiveBase64?: string;
		tasks?: Array<Record<string, unknown>>;
	};

	if (data.archiveBase64) {
		await restoreBackupArchive(data.archiveBase64, userId, prisma);
	}

	return {
		success: true,
		message:
			"Workspace data successfully synced and restored from Google Drive",
	};
}
