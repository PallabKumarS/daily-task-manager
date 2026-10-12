import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../../config/index.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { encryptToken } from "../../utils/cryptoVault.js";
import {
	exchangeCodeForTokens,
	getGoogleProfile,
	listGoogleDriveBackups,
} from "../../utils/googleDrive.js";
import { prisma } from "../../utils/prisma.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as authService from "../auth/auth.service.js";
import * as syncService from "./sync.service.js";

async function handleRestoreOnboardingCallback(
	_req: Request,
	res: Response,
	code: string,
): Promise<void> {
	try {
		const tokens = await exchangeCodeForTokens(code);
		const profile = await getGoogleProfile(tokens.accessToken);

		let user = await prisma.user.findUnique({
			where: { email: profile.email.toLowerCase() },
		});

		if (!user) {
			const salt = await bcrypt.genSalt(10);
			const passwordHash = await bcrypt.hash(`DayPulse_${Date.now()}`, salt);
			user = await prisma.user.create({
				data: {
					name: profile.name || "Restored User",
					email: profile.email.toLowerCase(),
					passwordHash,
					currency: "USD",
				},
			});
		}

		const encryptedAccess = encryptToken(tokens.accessToken);
		const encryptedRefresh = tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined;
		const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

		await prisma.googleConnection.upsert({
			where: { userId: user.id },
			update: {
				googleEmail: profile.email,
				encryptedAccess,
				...(encryptedRefresh && { encryptedRefresh }),
				tokenExpiry,
			},
			create: {
				userId: user.id,
				googleEmail: profile.email,
				encryptedAccess,
				encryptedRefresh: encryptedRefresh || "",
				tokenExpiry,
			},
		});

		let restoreSummary = "Account connected";
		try {
			const backups = await listGoogleDriveBackups(tokens.accessToken);
			if (backups.length > 0) {
				const restoreResult = await syncService.restoreFromDriveInDB(user.id, backups[0].id);
				restoreSummary = `Restored ${restoreResult.restoredCounts.tasks} tasks, ${restoreResult.restoredCounts.routines} routines, ${restoreResult.restoredCounts.transactions} transactions`;
			}
		} catch (err) {
			console.warn("[DayPulse Server] Google Drive restore notice:", err);
		}

		const token = jwt.sign({ userId: user.id, email: user.email }, config.jwt.secret, {
			expiresIn: config.jwt.expiresIn,
		} as jwt.SignOptions);

		authService.setLatestRestoreLoginResult({
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				currency: user.currency,
			},
			token,
			summary: restoreSummary,
			restoredAt: new Date().toISOString(),
		});

		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(`
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>DayPulse - Workspace Restored</title>
				<style>
					body { background: #090d16; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
					.card { background: #0f172a; padding: 40px; border-radius: 24px; border: 1px solid #1e293b; max-width: 420px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
					h2 { color: #34d399; margin: 0 0 12px; font-size: 22px; font-weight: 700; }
					p { color: #94a3b8; font-size: 14px; margin: 8px 0; line-height: 1.6; }
					.badge { display: inline-block; background: rgba(16,185,129,0.15); color: #34d399; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 16px; border: 1px solid rgba(16,185,129,0.3); }
				</style>
			</head>
			<body>
				<div class="card">
					<h2>Workspace Restored</h2>
					<p>Your Google Drive connection is verified for <strong>${profile.email}</strong>.</p>
					<p>You can close this window and return to DayPulse.</p>
					<div class="badge">Restore Complete</div>
				</div>
			</body>
			</html>
		`);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to restore Google account";
		res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
		res.end(`<h2>Connection error: ${message}</h2>`);
	}
}

export const handleGoogleOAuthCallback = catchAsync(async (req: Request, res: Response) => {
	const code = req.query.code as string;
	const state = req.query.state as string;

	if (!code || !state) {
		return res.redirect(
			`${config.clientUrl}/settings?sync_error=${encodeURIComponent("Missing code or state")}`,
		);
	}

	if (state === "restore_onboarding") {
		await handleRestoreOnboardingCallback(req, res, code);
		return;
	}

	try {
		const result = await syncService.connectGoogleInDB(state, code);
		res.redirect(
			`${config.clientUrl}/settings?sync_status=connected&email=${encodeURIComponent(result.email || "")}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to connect Google account";
		res.redirect(`${config.clientUrl}/settings?sync_error=${encodeURIComponent(message)}`);
	}
});

export const getSyncStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await syncService.getSyncStatusFromDB(req.user!.userId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Sync status retrieved successfully.",
		data: result,
	});
});

export const getAuthUrl = catchAsync(async (req: Request, res: Response) => {
	const result = syncService.getGoogleOAuthUrl(req.user!.userId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Google OAuth URL generated successfully.",
		data: result,
	});
});

export const connectGoogle = catchAsync(async (req: Request, res: Response) => {
	const result = await syncService.connectGoogleInDB(req.user!.userId, req.body.code);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Google Drive connected and credentials encrypted successfully.",
		data: result,
	});
});

export const uploadToDrive = catchAsync(async (req: Request, res: Response) => {
	const result = await syncService.uploadToDriveFromDB(req.user!.userId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Backup successfully synchronized and overwritten to Google Drive.",
		data: result,
	});
});

export const listDriveBackups = catchAsync(async (req: Request, res: Response) => {
	const result = await syncService.listDriveBackupsFromDB(req.user!.userId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Google Drive backups retrieved successfully.",
		data: result,
	});
});

export const restoreFromDrive = catchAsync(async (req: Request, res: Response) => {
	const result = await syncService.restoreFromDriveInDB(req.user!.userId, req.body.fileId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Data successfully restored idempotently from Google Drive.",
		data: result,
	});
});

export const disconnectGoogle = catchAsync(async (req: Request, res: Response) => {
	const result = await syncService.disconnectGoogleInDB(req.user!.userId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Google Drive disconnected.",
		data: result,
	});
});

export const simulateSync = catchAsync(async (req: Request, res: Response) => {
	const action = req.body.action as "export" | "import";
	const result = await syncService.simulateSyncInDB(req.user!.userId, action, req.body.data);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: `Simulated sync ${action} completed successfully.`,
		data: result,
	});
});
