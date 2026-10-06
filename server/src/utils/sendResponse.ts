import type { Response } from "express";

export const sendResponse = <T>(
	res: Response,
	data: {
		statusCode: number;
		success: boolean;
		message?: string;
		data: T | null;
		meta?: { page?: number; limit?: number; totalData?: number; totalPage?: number } | null;
	},
): void => {
	res.status(data.statusCode).json({
		statusCode: data.statusCode,
		success: data.success,
		message: data.message,
		data: data.data ?? null,
		meta: data.meta ?? null,
	});
};
