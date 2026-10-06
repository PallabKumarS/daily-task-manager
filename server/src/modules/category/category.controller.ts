import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as categoryService from "./category.service.js";

export const getCategories = catchAsync(async (req: Request, res: Response) => {
	const group = typeof req.query.group === "string" ? req.query.group : undefined;
	const result = await categoryService.getCategoriesFromDB(req.user!.userId, group);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Categories retrieved successfully.",
		data: result,
	});
});

export const createCategory = catchAsync(async (req: Request, res: Response) => {
	const result = await categoryService.createCategoryInDB(req.user!.userId, req.body);

	sendResponse(res, {
		statusCode: 201,
		success: true,
		message: "Category created successfully.",
		data: result,
	});
});

export const updateCategory = catchAsync(async (req: Request, res: Response) => {
	const result = await categoryService.updateCategoryInDB(
		req.user!.userId,
		req.params.id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Category updated successfully.",
		data: result,
	});
});

export const deleteCategory = catchAsync(async (req: Request, res: Response) => {
	const result = await categoryService.deleteCategoryFromDB(
		req.user!.userId,
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: 200,
		success: true,
		message: "Category deleted successfully.",
		data: result,
	});
});
