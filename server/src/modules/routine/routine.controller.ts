import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as routineService from "./routine.service.js";

export const getRoutines = catchAsync(async (req: Request, res: Response) => {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  const result = await routineService.getRoutinesFromDB(req.user!.userId, date);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Routines retrieved successfully.",
    data: result,
  });
});

export const createRoutine = catchAsync(async (req: Request, res: Response) => {
  const result = await routineService.createRoutineInDB(req.user!.userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Routine created successfully.",
    data: result,
  });
});

export const updateRoutine = catchAsync(async (req: Request, res: Response) => {
  const result = await routineService.updateRoutineInDB(
    req.user!.userId,
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Routine updated successfully.",
    data: result,
  });
});

export const deleteRoutine = catchAsync(async (req: Request, res: Response) => {
  const result = await routineService.deleteRoutineFromDB(
    req.user!.userId,
    req.params.id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Routine deleted successfully.",
    data: result,
  });
});

export const toggleRoutine = catchAsync(async (req: Request, res: Response) => {
  const date = typeof req.body.date === "string" ? req.body.date : undefined;
  const result = await routineService.toggleRoutineInDB(
    req.user!.userId,
    req.params.id as string,
    date
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.isCompletedToday ? "Routine completed." : "Routine marked incomplete.",
    data: result,
  });
});
