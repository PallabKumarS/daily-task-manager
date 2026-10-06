import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as syncService from "./sync.service.js";

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

export const handleGoogleOAuthCallback = catchAsync(async (req: Request, res: Response) => {
	const code = req.query.code as string;
	const state = req.query.state as string;

	if (!code || !state) {
		return res.redirect(
			`http://localhost:3000/settings?sync_error=${encodeURIComponent("Missing code or state")}`,
		);
	}

	try {
		const result = await syncService.connectGoogleInDB(state, code);
		res.redirect(
			`http://localhost:3000/settings?sync_status=connected&email=${encodeURIComponent(result.email || "")}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to connect Google account";
		res.redirect(`http://localhost:3000/settings?sync_error=${encodeURIComponent(message)}`);
	}
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
