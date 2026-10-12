import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createBackupArchive } from "./archive-builder";
import { restoreBackupArchive } from "./archive-extractor";
import { mergeBackupIntoUser, summarizeMergeReport } from "./backup-merge";
import { decryptToken, encryptToken } from "./crypto-vault";
import { startSession } from "./session-store";

function getCredentialsFilePath(): string {
	const baseDir = process.env.USER_DATA_PATH || process.cwd();
	return path.join(baseDir, "google-credentials.json");
}

function loadPersistedCredentials(): { clientId?: string; clientSecret?: string } {
	try {
		const filePath = getCredentialsFilePath();
		if (fs.existsSync(filePath)) {
			const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
			return data || {};
		}
	} catch {
		// Suppress disk read failure
	}
	return {};
}

let runtimeClientId = "";
let runtimeClientSecret = "";

export function saveGoogleCredentials(clientId: string, clientSecret: string): void {
	runtimeClientId = clientId.trim();
	runtimeClientSecret = clientSecret.trim();
	try {
		const filePath = getCredentialsFilePath();
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(
			filePath,
			JSON.stringify({ clientId: runtimeClientId, clientSecret: runtimeClientSecret }, null, 2),
			"utf8",
		);
	} catch {
		// Suppress disk write failure
	}
}

export const getGoogleClientId = (): string => {
	if (runtimeClientId) return runtimeClientId;
	const persisted = loadPersistedCredentials();
	if (persisted.clientId) {
		runtimeClientId = persisted.clientId;
		return runtimeClientId;
	}
	return process.env.GOOGLE_CLIENT_ID_DESKTOP || process.env.GOOGLE_CLIENT_ID || "";
};

export const getGoogleClientSecret = (): string => {
	if (runtimeClientSecret) return runtimeClientSecret;
	const persisted = loadPersistedCredentials();
	if (persisted.clientSecret) {
		runtimeClientSecret = persisted.clientSecret;
		return runtimeClientSecret;
	}
	return process.env.GOOGLE_CLIENT_SECRET_DESKTOP || process.env.GOOGLE_CLIENT_SECRET || "";
};

export const getGoogleRedirectUri = (): string => {
	if (process.env.GOOGLE_REDIRECT_URI) {
		return process.env.GOOGLE_REDIRECT_URI;
	}
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/v1/sync/google/callback`;
	}
	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
		return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/v1/sync/google/callback`;
	}
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}/api/v1/sync/google/callback`;
	}
	return "http://localhost:5000/api/v1/sync/google/callback";
};

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
	const clientId = getGoogleClientId();
	const clientSecret = getGoogleClientSecret();
	return Boolean(
		clientId &&
			clientSecret &&
			clientId !== "your-google-client-id-here" &&
			clientSecret !== "your-google-client-secret-here",
	);
}

export function getGoogleAuthUrl(userId: string): string {
	if (!isGoogleConfigured()) {
		throw new Error(
			"Google Drive sync is not configured. Please define GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
		);
	}

	const scopes = [
		"https://www.googleapis.com/auth/drive.file",
		"https://www.googleapis.com/auth/userinfo.email",
		"https://www.googleapis.com/auth/userinfo.profile",
	].join(" ");

	const params = new URLSearchParams({
		client_id: getGoogleClientId(),
		redirect_uri: getGoogleRedirectUri(),
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
			client_id: getGoogleClientId(),
			client_secret: getGoogleClientSecret(),
			redirect_uri: getGoogleRedirectUri(),
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

export async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
	const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

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
			client_id: getGoogleClientId(),
			client_secret: getGoogleClientSecret(),
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

export async function getValidAccessToken(prisma: PrismaClient, userId: string): Promise<string> {
	const connection = await prisma.googleConnection.findUnique({
		where: { userId },
	});

	if (!connection) {
		throw new Error("Google Drive is not connected for this account.");
	}

	const rawAccess = decryptToken(connection.encryptedAccess);
	const rawRefresh = connection.encryptedRefresh ? decryptToken(connection.encryptedRefresh) : "";

	const now = new Date();
	const expiry = connection.tokenExpiry ? new Date(connection.tokenExpiry) : null;
	const isExpiringSoon = expiry ? expiry.getTime() - now.getTime() < 5 * 60 * 1000 : true;

	if ((isExpiringSoon || !rawAccess) && rawRefresh) {
		try {
			const refreshed = await refreshGoogleAccessToken(rawRefresh);
			const tokenExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);

			await prisma.googleConnection.update({
				where: { userId },
				data: {
					encryptedAccess: encryptToken(refreshed.accessToken),
					tokenExpiry,
				},
			});

			return refreshed.accessToken;
		} catch (refreshErr) {
			console.warn("[DayPulse Google Sync] Refresh token attempt notice:", refreshErr);
			if (rawAccess && !isExpiringSoon) {
				return rawAccess;
			}
			throw new Error(
				"Google Drive session has expired. Please reconnect your Google account in Settings.",
			);
		}
	}

	if (!rawAccess) {
		throw new Error(
			"Google Drive session has expired. Please reconnect your Google account in Settings.",
		);
	}

	return rawAccess;
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

	if (searchRes.status === 401) {
		throw new Error(
			"Google Drive session has expired (401). Please reconnect your Google account in Settings.",
		);
	}

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

		if (updateRes.status === 401) {
			throw new Error(
				"Google Drive session has expired (401). Please reconnect your Google account in Settings.",
			);
		}

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

	if (createRes.status === 401) {
		throw new Error(
			"Google Drive session has expired (401). Please reconnect your Google account in Settings.",
		);
	}

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
		q: `(name = '${fileName}' or name = 'DayPulse_Backup.zip') and trashed = false`,
		fields: "files(id, name, modifiedTime, mimeType)",
		orderBy: "modifiedTime desc",
	});

	const searchRes = await fetch(
		`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (searchRes.status === 401) {
		throw new Error(
			"Google Drive session has expired (401). Please reconnect your Google account in Settings.",
		);
	}

	if (!searchRes.ok) {
		throw new Error("Failed to search Google Drive for backups");
	}

	const searchJson = (await searchRes.json()) as {
		files?: Array<{ id: string; name: string }>;
	};
	if (!searchJson.files || searchJson.files.length === 0) {
		throw new Error("No DayPulse backups found on your Google Drive");
	}

	const targetFile = searchJson.files[0];
	const downloadRes = await fetch(
		`https://www.googleapis.com/drive/v3/files/${targetFile.id}?alt=media`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (downloadRes.status === 401) {
		throw new Error(
			"Google Drive session has expired (401). Please reconnect your Google account in Settings.",
		);
	}

	if (!downloadRes.ok) {
		throw new Error("Failed to download backup content from Google Drive");
	}

	if (targetFile.name.endsWith(".zip")) {
		const arrayBuf = await downloadRes.arrayBuffer();
		const buffer = Buffer.from(arrayBuf);
		return {
			archiveBase64: buffer.toString("base64"),
		};
	}

	return downloadRes.json();
}

export interface GoogleRestoreLoginResult {
	user: {
		id: string;
		email: string;
		name: string;
		currency: string;
	};
	token: string;
	summary: string;
	restoredAt: string;
}

let latestGoogleRestoreLoginResult: GoogleRestoreLoginResult | null = null;

export function getLatestGoogleRestoreLoginResult(): GoogleRestoreLoginResult | null {
	return latestGoogleRestoreLoginResult;
}

export function clearLatestGoogleRestoreLoginResult(): void {
	latestGoogleRestoreLoginResult = null;
}

export async function processGoogleOAuthCode(
	prisma: PrismaClient,
	rawCode: string,
	stateParam = "restore_onboarding",
): Promise<{
	profile: GoogleProfile;
	result: GoogleRestoreLoginResult | null;
	isOnboardingRestore: boolean;
}> {
	let code = rawCode.trim();
	if (code.includes("code=")) {
		try {
			const u = new URL(code.startsWith("http") ? code : `http://dummy.com/${code}`);
			code = u.searchParams.get("code") || code;
		} catch {}
	}

	const tokens = await exchangeCodeForTokens(code);
	const profile = await getGoogleProfile(tokens.accessToken);
	const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

	const isOnboardingRestore =
		stateParam === "restore_onboarding" ||
		stateParam === "login_restore" ||
		stateParam.startsWith("restore");

	let activeUserId = stateParam;

	if (isOnboardingRestore || !activeUserId) {
		let targetUser = await prisma.user.findUnique({
			where: { email: profile.email },
		});

		if (!targetUser) {
			const salt = await bcrypt.genSalt(10);
			const defaultPass = await bcrypt.hash(`DayPulse@${profile.id.slice(-6)}`, salt);
			targetUser = await prisma.user.create({
				data: {
					email: profile.email,
					name: profile.name || "Google User",
					passwordHash: defaultPass,
					currency: "USD",
				},
			});
		}

		activeUserId = targetUser.id;
	}

	await prisma.googleConnection.upsert({
		where: { userId: activeUserId },
		update: {
			googleId: profile.id,
			googleEmail: profile.email,
			encryptedAccess: encryptToken(tokens.accessToken),
			encryptedRefresh: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
			tokenExpiry,
		},
		create: {
			userId: activeUserId,
			googleId: profile.id,
			googleEmail: profile.email,
			encryptedAccess: encryptToken(tokens.accessToken),
			encryptedRefresh: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
			tokenExpiry,
		},
	});

	let restoreSummary = "";
	if (isOnboardingRestore) {
		try {
			const backupData = (await downloadLatestBackupFromGoogleDrive(tokens.accessToken)) as {
				archiveBase64?: string;
				tasks?: Array<Record<string, unknown>>;
				routines?: Array<Record<string, unknown>>;
				transactions?: Array<Record<string, unknown>>;
				trackers?: Array<Record<string, unknown>>;
				categories?: Array<Record<string, unknown>>;
			};

			if (backupData.archiveBase64) {
				const restoreResult = await restoreBackupArchive(
					backupData.archiveBase64,
					activeUserId,
					prisma,
				);
				restoreSummary = restoreResult.summary || "Data restored";
			} else if (
				Array.isArray(backupData.tasks) ||
				Array.isArray(backupData.routines) ||
				Array.isArray(backupData.transactions) ||
				Array.isArray(backupData.trackers) ||
				Array.isArray(backupData.categories)
			) {
				const mergeReport = await mergeBackupIntoUser(prisma, activeUserId, {
					tasks: backupData.tasks || [],
					routines: backupData.routines || [],
					routineLogs:
						((backupData as Record<string, unknown>).routineLogs as Array<
							Record<string, unknown>
						>) || [],
					transactions: backupData.transactions || [],
					trackers: backupData.trackers || [],
					trackerLogs:
						((backupData as Record<string, unknown>).trackerLogs as Array<
							Record<string, unknown>
						>) || [],
					categories: backupData.categories || [],
				});
				restoreSummary = summarizeMergeReport(mergeReport);
			}
		} catch (restoreErr) {
			console.warn("[DayPulse Google Sync] Notice during onboarding backup download:", restoreErr);
		}

		const currentUser = await prisma.user.findUnique({
			where: { id: activeUserId },
		});

		if (currentUser) {
			startSession(currentUser.id);
			latestGoogleRestoreLoginResult = {
				user: {
					id: currentUser.id,
					email: currentUser.email,
					name: currentUser.name,
					currency: currentUser.currency,
				},
				token: `daypulse_token_${currentUser.id}`,
				summary: restoreSummary || "Workspace restored from Google Drive",
				restoredAt: new Date().toISOString(),
			};
		}
	}

	return {
		profile,
		result: latestGoogleRestoreLoginResult,
		isOnboardingRestore,
	};
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
				const stateParam = reqUrl.searchParams.get("state") || "";

				if (!code) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end("<h2>Authentication error: missing authorization code</h2>");
					return;
				}

				const { profile, isOnboardingRestore } = await processGoogleOAuthCode(
					prisma,
					code,
					stateParam,
				);

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
							<h2>${isOnboardingRestore ? "Workspace Restored" : "Google Account Connected"}</h2>
							<p>${isOnboardingRestore ? `Your Google Drive data for ${profile.email} has been restored into DayPulse.` : `Your Google Drive connection is now active in DayPulse (${profile.email}).`}</p>
							<p>You can close this tab and return to the DayPulse workspace.</p>
							<div class="badge">${isOnboardingRestore ? "Restore Complete" : "Connection Active"}</div>
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
		console.log("[DayPulse Desktop] Google OAuth loopback listener active on port 5000");
	});

	loopbackServer.on("error", (err) => {
		console.warn("[DayPulse Desktop] Loopback listener notice:", err);
	});
}

export function stopGoogleOAuthLoopbackServer(): void {
	if (loopbackServer) {
		try {
			loopbackServer.close();
		} catch {
			// Ignore if already closed
		}
		loopbackServer = null;
	}
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
): Promise<{ success: boolean; message: string; summary?: string }> {
	const accessToken = await getValidAccessToken(prisma, userId);
	const data = (await downloadLatestBackupFromGoogleDrive(accessToken)) as {
		archiveBase64?: string;
		tasks?: Array<Record<string, unknown>>;
		routines?: Array<Record<string, unknown>>;
		routineLogs?: Array<Record<string, unknown>>;
		transactions?: Array<Record<string, unknown>>;
		trackers?: Array<Record<string, unknown>>;
		trackerLogs?: Array<Record<string, unknown>>;
		categories?: Array<Record<string, unknown>>;
	};

	let summary = "";
	if (data.archiveBase64) {
		const res = await restoreBackupArchive(data.archiveBase64, userId, prisma);
		summary = res.summary || "Data restored";
	} else if (
		Array.isArray(data.tasks) ||
		Array.isArray(data.routines) ||
		Array.isArray(data.transactions) ||
		Array.isArray(data.trackers) ||
		Array.isArray(data.categories)
	) {
		const res = await mergeBackupIntoUser(prisma, userId, {
			tasks: data.tasks || [],
			routines: data.routines || [],
			routineLogs: data.routineLogs || [],
			transactions: data.transactions || [],
			trackers: data.trackers || [],
			trackerLogs: data.trackerLogs || [],
			categories: data.categories || [],
		});
		summary = summarizeMergeReport(res);
	}

	return {
		success: true,
		message: summary
			? `Workspace restored from Google Drive: ${summary}`
			: "Workspace data successfully synced and restored from Google Drive",
		summary,
	};
}
