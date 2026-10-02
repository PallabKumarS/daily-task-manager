import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as trackerService from "./tracker.service.js";

export const getTrackers = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const targetDate =
		typeof req.query.date === "string" ? req.query.date : undefined;
	const result = await trackerService.getTrackersFromDB(userId, targetDate);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Trackers retrieved successfully.",
		data: result,
	});
});

export const getTrackerDetails = catchAsync(
	async (req: Request, res: Response) => {
		const userId = req.user?.userId as string;
		const trackerId = req.params.id as string;
		const year = req.query.year ? Number(req.query.year) : undefined;
		const month = req.query.month ? Number(req.query.month) : undefined;

		const result = await trackerService.getTrackerDetailsFromDB(
			userId,
			trackerId,
			year,
			month,
		);

		sendResponse(res, {
			statusCode: 200,
			success: true,
			message: "Tracker details retrieved successfully.",
			data: result,
		});
	},
);

export const createTracker = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await trackerService.createTrackerInDB(userId, req.body);

	sendResponse(res, {
		statusCode: 201,
		success: true,
		message: "Tracker created successfully.",
		data: result,
	});
});

export const updateTracker = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const trackerId = req.params.id as string;
	const result = await trackerService.updateTrackerInDB(
		userId,
		trackerId,
		req.body,
	);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Tracker updated successfully.",
		data: result,
	});
});

export const deleteTracker = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const trackerId = req.params.id as string;
	const result = await trackerService.deleteTrackerInDB(userId, trackerId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Tracker deleted successfully.",
		data: result,
	});
});

export const logTrackerDay = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const trackerId = req.params.id as string;
	const result = await trackerService.logTrackerDayInDB(
		userId,
		trackerId,
		req.body,
	);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Tracker count logged successfully.",
		data: result,
	});
});

export const settleTracker = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const trackerId = req.params.id as string;
	const result = await trackerService.settleTrackerInDB(
		userId,
		trackerId,
		req.body,
	);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Tracker settlement recorded in finances.",
		data: result,
	});
});
