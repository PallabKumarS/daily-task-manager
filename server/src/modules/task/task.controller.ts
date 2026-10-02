import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import * as taskService from "./task.service.js";

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    type: typeof req.query.type === "string" ? req.query.type : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
    upcoming: req.query.upcoming === "true",
  };

  const result = await taskService.getTasksFromDB(req.user!.userId, filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Tasks retrieved successfully.",
    data: result,
  });
});

export const createTask = catchAsync(async (req: Request, res: Response) => {
  const result = await taskService.createTaskInDB(req.user!.userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: `${result.type === "EVENT" ? "Event" : "Task"} created successfully.`,
    data: result,
  });
});

export const updateTask = catchAsync(async (req: Request, res: Response) => {
  const result = await taskService.updateTaskInDB(
    req.user!.userId,
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Updated successfully.",
    data: result,
  });
});

export const deleteTask = catchAsync(async (req: Request, res: Response) => {
  const result = await taskService.deleteTaskFromDB(
    req.user!.userId,
    req.params.id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Deleted successfully.",
    data: result,
  });
});
