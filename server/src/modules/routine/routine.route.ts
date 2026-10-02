import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as routineValidation from "./routine.validation.js";
import * as routineController from "./routine.controller.js";

const router = Router();

router.use(auth());

router.get("/", routineController.getRoutines);
router.post(
  "/",
  validateRequest(routineValidation.createRoutineValidationSchema),
  routineController.createRoutine
);
router.patch(
  "/:id",
  validateRequest(routineValidation.updateRoutineValidationSchema),
  routineController.updateRoutine
);
router.delete("/:id", routineController.deleteRoutine);
router.post("/:id/toggle", routineController.toggleRoutine);

export const routineRoutes = router;
