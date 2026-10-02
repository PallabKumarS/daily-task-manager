import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as taskValidation from "./task.validation.js";
import * as taskController from "./task.controller.js";

const router = Router();

router.use(auth());

router.get("/", taskController.getTasks);
router.post(
  "/",
  validateRequest(taskValidation.createTaskValidationSchema),
  taskController.createTask
);
router.patch(
  "/:id",
  validateRequest(taskValidation.updateTaskValidationSchema),
  taskController.updateTask
);
router.delete("/:id", taskController.deleteTask);

export const taskRoutes = router;
