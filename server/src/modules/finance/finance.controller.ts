import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as financeService from "./finance.service.js";

export const getTransactions = catchAsync(async (req: Request, res: Response) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const result = await financeService.getTransactionsFromDB(req.user!.userId, {
    type,
    category,
    startDate,
    endDate,
    limit,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Transactions retrieved successfully.",
    data: result,
  });
});

export const createTransaction = catchAsync(async (req: Request, res: Response) => {
  const result = await financeService.createTransactionInDB(req.user!.userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Transaction created successfully.",
    data: result,
  });
});

export const updateTransaction = catchAsync(async (req: Request, res: Response) => {
  const result = await financeService.updateTransactionInDB(
    req.user!.userId,
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Transaction updated successfully.",
    data: result,
  });
});

export const deleteTransaction = catchAsync(async (req: Request, res: Response) => {
  const result = await financeService.deleteTransactionFromDB(
    req.user!.userId,
    req.params.id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Transaction deleted successfully.",
    data: result,
  });
});

export const getCumulativeAnalytics = catchAsync(async (req: Request, res: Response) => {
  const period = typeof req.query.period === "string" ? req.query.period : "month";
  const baseDate = typeof req.query.date === "string" ? new Date(req.query.date) : new Date();

  const result = await financeService.getCumulativeAnalyticsFromDB(
    req.user!.userId,
    period,
    baseDate
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Cumulative analytics calculated successfully.",
    data: result,
  });
});
