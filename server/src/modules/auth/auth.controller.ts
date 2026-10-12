import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as authService from "./auth.service.js";

export const register = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.registerUserIntoDB(req.body);

	res.cookie("token", result.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 30 * 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: 201,
		success: true,
		message: "Registration successful.",
		data: result,
	});
});

export const login = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.loginUserIntoDB(req.body);

	res.cookie("token", result.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 30 * 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Logged in successfully.",
		data: result,
	});
});

export const logout = catchAsync(async (req: Request, res: Response) => {
	res.clearCookie("token");

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Logged out successfully.",
		data: null,
	});
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.getMeFromDB(req.user!.userId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "User profile retrieved.",
		data: result,
	});
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.updateProfileInDB(req.user!.userId, req.body);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Profile updated successfully.",
		data: result,
	});
});

export const getGoogleRestoreUrl = catchAsync(async (_req: Request, res: Response) => {
	const result = authService.getGoogleRestoreUrl();

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Google restore URL generated.",
		data: result,
	});
});

export const getGoogleRestoreStatus = catchAsync(async (_req: Request, res: Response) => {
	const result = authService.getLatestRestoreLoginResult();

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Google restore status retrieved.",
		data: result,
	});
});

export const restoreBackup = catchAsync(async (req: Request, res: Response) => {
	const result = await authService.restoreBackupArchiveIntoDB(req.body);

	res.cookie("token", result.token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 30 * 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: result.summary,
		data: result,
	});
});
