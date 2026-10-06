import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import config from "../config/index.js";
import { AppError } from "../errors/AppError.js";

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
	let statusCode = 500;
	let message = "Internal Server Error";
	let errorMessages: Array<{ path: string | number; message: string }> = [];

	if (err instanceof ZodError) {
		statusCode = 400;
		message = "Validation Error";
		errorMessages = err.issues.map((issue) => ({
			path: issue.path[issue.path.length - 1],
			message: issue.message,
		}));
	} else if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errorMessages = [{ path: "", message: err.message }];
	} else if (err instanceof Error) {
		message = err.message;
		errorMessages = [{ path: "", message: err.message }];
	}

	res.status(statusCode).json({
		statusCode,
		success: false,
		message,
		errorMessages,
		stack: config.env === "development" ? err?.stack : undefined,
	});
};
