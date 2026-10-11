import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as debtLoanService from "./debt-loan.service.js";

export const getDebtsLoans = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await debtLoanService.getDebtsLoansFromDB(userId, req.query);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Debts and loans retrieved successfully.",
		data: result,
	});
});

export const getDebtLoanDetails = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const debtLoanId = req.params.id as string;
	const result = await debtLoanService.getDebtLoanDetailsFromDB(userId, debtLoanId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Debt or loan details retrieved successfully.",
		data: result,
	});
});

export const createDebtLoan = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const result = await debtLoanService.createDebtLoanInDB(userId, req.body);

	sendResponse(res, {
		statusCode: 201,
		success: true,
		message: "Debt or loan created successfully.",
		data: result,
	});
});

export const recordRepayment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const debtLoanId = req.params.id as string;
	const result = await debtLoanService.recordRepaymentInDB(userId, debtLoanId, req.body);

	sendResponse(res, {
		statusCode: 201,
		success: true,
		message: "Repayment recorded successfully.",
		data: result,
	});
});

export const updateDebtLoan = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const debtLoanId = req.params.id as string;
	const result = await debtLoanService.updateDebtLoanInDB(userId, debtLoanId, req.body);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Debt or loan updated successfully.",
		data: result,
	});
});

export const deleteDebtLoan = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const debtLoanId = req.params.id as string;
	await debtLoanService.deleteDebtLoanFromDB(userId, debtLoanId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Debt or loan deleted successfully.",
		data: null,
	});
});

export const deleteRepayment = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user?.userId as string;
	const debtLoanId = req.params.id as string;
	const repaymentId = req.params.repaymentId as string;
	await debtLoanService.deleteRepaymentFromDB(userId, debtLoanId, repaymentId);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Repayment deleted successfully.",
		data: null,
	});
});
