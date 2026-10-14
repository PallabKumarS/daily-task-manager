import { exportLocalArchive } from "./export-local-archive";

const STORAGE_KEYS = {
	CREDS: "daypulse_google_credentials",
	TOKENS: "daypulse_google_tokens",
	STATUS: "daypulse_google_sync_status",
};

export interface ClientGoogleCredentials {
	clientId: string;
	clientSecret: string;
}

export interface ClientGoogleTokens {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
	email?: string;
}

export function saveClientGoogleCredentials(clientId: string, clientSecret: string): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(
		STORAGE_KEYS.CREDS,
		JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
	);
}

export function getClientGoogleCredentials(): ClientGoogleCredentials | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.CREDS);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed.clientId && parsed.clientSecret) {
				return parsed as ClientGoogleCredentials;
			}
		}
	} catch {
		// Suppress parse failure
	}

	const envClientId =
		process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID_DESKTOP || "";
	const envClientSecret =
		process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET_DESKTOP || "";

	if (envClientId) {
		return {
			clientId: envClientId,
			clientSecret: envClientSecret,
		};
	}

	return null;
}

export function isClientGoogleConfigured(): boolean {
	const creds = getClientGoogleCredentials();
	return Boolean(creds?.clientId);
}

export function saveClientGoogleTokens(tokens: {
	accessToken: string;
	refreshToken?: string;
	expiresIn?: number;
	email?: string;
}): void {
	if (typeof window === "undefined") return;
	const existing = getClientGoogleTokens();
	const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;
	const payload: ClientGoogleTokens = {
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken || existing?.refreshToken,
		expiresAt,
		email: tokens.email || existing?.email,
	};
	localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(payload));
}

export function getClientGoogleTokens(): ClientGoogleTokens | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.TOKENS);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function clearClientGoogleTokens(): void {
	if (typeof window === "undefined") return;
	localStorage.removeItem(STORAGE_KEYS.TOKENS);
}

export function getClientGoogleRedirectUri(): string {
	if (typeof window !== "undefined" && window.location.origin) {
		return `${window.location.origin}/api/v1/sync/google/callback`;
	}
	if (process.env.NEXT_PUBLIC_APP_URL) {
		return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/v1/sync/google/callback`;
	}
	return "http://localhost:5000/api/v1/sync/google/callback";
}

export function getClientGoogleAuthUrl(redirectUri = getClientGoogleRedirectUri()): string {
	const creds = getClientGoogleCredentials();
	if (!creds?.clientId) {
		throw new Error("Google Client ID is not configured. Please enter your credentials first.");
	}

	const scopes = [
		"https://www.googleapis.com/auth/drive.file",
		"https://www.googleapis.com/auth/userinfo.email",
		"https://www.googleapis.com/auth/userinfo.profile",
	].join(" ");

	const params = new URLSearchParams({
		client_id: creds.clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: scopes,
		access_type: "offline",
		prompt: "consent",
		include_granted_scopes: "true",
	});

	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeClientCodeForTokens(
	code: string,
	redirectUri = getClientGoogleRedirectUri(),
): Promise<{ accessToken: string; email?: string }> {
	const creds = getClientGoogleCredentials();
	if (!creds?.clientId || !creds?.clientSecret) {
		throw new Error("Google OAuth credentials missing. Please set Client ID and Client Secret.");
	}

	let cleanCode = code.trim();
	if (cleanCode.includes("code=")) {
		try {
			const u = new URL(cleanCode.startsWith("http") ? cleanCode : `http://dummy.com/${cleanCode}`);
			cleanCode = u.searchParams.get("code") || cleanCode;
		} catch {}
	}

	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code: cleanCode,
			client_id: creds.clientId,
			client_secret: creds.clientSecret,
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
		}),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Google token exchange failed: ${errText}`);
	}

	const json = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
	};

	let userEmail = "";
	try {
		const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
			headers: { Authorization: `Bearer ${json.access_token}` },
		});
		if (profileRes.ok) {
			const profile = (await profileRes.json()) as { email?: string };
			userEmail = profile.email || "";
		}
	} catch {}

	saveClientGoogleTokens({
		accessToken: json.access_token,
		refreshToken: json.refresh_token,
		expiresIn: json.expires_in,
		email: userEmail,
	});

	return { accessToken: json.access_token, email: userEmail };
}

export async function getValidClientAccessToken(): Promise<string> {
	const tokens = getClientGoogleTokens();
	if (!tokens) {
		throw new Error("Google account is not connected. Please connect Google Drive first.");
	}

	// Buffer of 60 seconds
	if (tokens.accessToken && tokens.expiresAt > Date.now() + 60000) {
		return tokens.accessToken;
	}

	if (!tokens.refreshToken) {
		throw new Error("Google authorization has expired. Please reconnect your Google account.");
	}

	const creds = getClientGoogleCredentials();
	if (!creds?.clientId || !creds?.clientSecret) {
		throw new Error("Google credentials are not configured.");
	}

	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			refresh_token: tokens.refreshToken,
			client_id: creds.clientId,
			client_secret: creds.clientSecret,
			grant_type: "refresh_token",
		}),
	});

	if (!response.ok) {
		throw new Error("Failed to refresh Google authorization session.");
	}

	const json = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};

	saveClientGoogleTokens({
		accessToken: json.access_token,
		expiresIn: json.expires_in,
	});

	return json.access_token;
}

export async function downloadBackupFromGoogleDrive(
	tokenOverride?: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	const accessToken = tokenOverride || (await getValidClientAccessToken());

	const searchParams = new URLSearchParams({
		q: "(name = 'DayPulse_Backup.json' or name = 'DayPulse_Backup.zip') and trashed = false",
		fields: "files(id, name, modifiedTime, mimeType)",
		orderBy: "modifiedTime desc",
	});

	const searchRes = await fetch(
		`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (searchRes.status === 401) {
		throw new Error(
			"Google Drive session has expired (401). Please reconnect your Google account.",
		);
	}

	if (!searchRes.ok) {
		throw new Error("Failed to search Google Drive for backups.");
	}

	const searchJson = (await searchRes.json()) as {
		files?: Array<{ id: string; name: string }>;
	};

	if (!searchJson.files || searchJson.files.length === 0) {
		return {
			success: false,
			error: "No DayPulse backup files found on your Google Drive.",
		};
	}

	const targetFile = searchJson.files[0];
	const downloadRes = await fetch(
		`https://www.googleapis.com/drive/v3/files/${targetFile.id}?alt=media`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (!downloadRes.ok) {
		throw new Error("Failed to download backup file from Google Drive.");
	}

	if (targetFile.name.endsWith(".zip")) {
		const arrayBuf = await downloadRes.arrayBuffer();
		let binary = "";
		const bytes = new Uint8Array(arrayBuf);
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		const base64 = btoa(binary);
		return {
			success: true,
			data: { archiveBase64: base64 },
		};
	}

	const json = await downloadRes.json();
	return { success: true, data: json };
}

export async function uploadBackupToGoogleDrive(
	tokenOverride?: string,
): Promise<{ success: boolean; message: string; lastSyncAt: string }> {
	const accessToken = tokenOverride || (await getValidClientAccessToken());
	const exportData = await exportLocalArchive();

	const searchParams = new URLSearchParams({
		q: "name = 'DayPulse_Backup.json' and trashed = false",
		fields: "files(id, name)",
	});

	const searchRes = await fetch(
		`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`,
		{ headers: { Authorization: `Bearer ${accessToken}` } },
	);

	let existingFileId: string | null = null;
	if (searchRes.ok) {
		const sJson = (await searchRes.json()) as { files?: Array<{ id: string }> };
		if (sJson.files && sJson.files.length > 0) {
			existingFileId = sJson.files[0].id;
		}
	}

	const backupPayload = JSON.stringify({
		exportedAt: exportData.manifest.exportedAt,
		manifest: exportData.manifest,
		archiveBase64: exportData.base64,
	});

	const boundary = "-------daypulse314159265";
	const delimiter = `\r\n--${boundary}\r\n`;
	const closeDelimiter = `\r\n--${boundary}--`;

	const metadata = {
		name: "DayPulse_Backup.json",
		mimeType: "application/json",
		description: "DayPulse mobile client cloud backup",
	};

	const multipartBody =
		delimiter +
		"Content-Type: application/json; charset=UTF-8\r\n\r\n" +
		JSON.stringify(metadata) +
		delimiter +
		"Content-Type: application/json\r\n\r\n" +
		backupPayload +
		closeDelimiter;

	let url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
	let method = "POST";

	if (existingFileId) {
		url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
		method = "PATCH";
	}

	const uploadRes = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": `multipart/related; boundary=${boundary}`,
		},
		body: multipartBody,
	});

	if (!uploadRes.ok) {
		const err = await uploadRes.text();
		throw new Error(`Google Drive upload failed: ${err}`);
	}

	const now = new Date().toISOString();
	localStorage.setItem(STORAGE_KEYS.STATUS, JSON.stringify({ lastSyncAt: now, status: "SUCCESS" }));

	return {
		success: true,
		message: "Workspace successfully backed up to Google Drive",
		lastSyncAt: now,
	};
}

export function getClientGoogleStatus(): { lastSyncAt?: string; status?: string } | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.STATUS);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

interface ClientRestoreState {
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

let latestRestoreState: ClientRestoreState | null = null;

export function getLatestClientRestoreResult(): ClientRestoreState | null {
	return latestRestoreState;
}

export function setLatestClientRestoreResult(state: ClientRestoreState | null): void {
	latestRestoreState = state;
}

export async function restoreGoogleDriveBackup(tokenOverride?: string) {
	const { restoreLocalArchive } = await import("./restore-local-archive");
	const downloadRes = await downloadBackupFromGoogleDrive(tokenOverride);

	if (!downloadRes.success || !downloadRes.data) {
		throw new Error(downloadRes.error || "No backup file found on Google Drive.");
	}

	const payload = downloadRes.data as Record<string, unknown>;
	let restoreResult: Awaited<ReturnType<typeof restoreLocalArchive>>;

	if (payload.archiveBase64 && typeof payload.archiveBase64 === "string") {
		restoreResult = await restoreLocalArchive(payload.archiveBase64);
	} else if (
		payload.data &&
		typeof (payload.data as Record<string, unknown>).archiveBase64 === "string"
	) {
		restoreResult = await restoreLocalArchive(
			(payload.data as Record<string, unknown>).archiveBase64 as string,
		);
	} else {
		restoreResult = await restoreLocalArchive(undefined, payload);
	}

	if (restoreResult.user && restoreResult.token) {
		setLatestClientRestoreResult({
			user: restoreResult.user,
			token: restoreResult.token,
			summary: restoreResult.message,
			restoredAt: new Date().toISOString(),
		});
	}

	const now = new Date().toISOString();
	localStorage.setItem(
		STORAGE_KEYS.STATUS,
		JSON.stringify({ lastSyncAt: now, status: "RESTORE_SUCCESS" }),
	);

	return restoreResult;
}
