import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as trackerController from "./tracker.controller.js";
import * as trackerValidation from "./tracker.validation.js";

const router = Router();

router.use(auth());

router.get("/", trackerController.getTrackers);
router.post(
	"/",
	validateRequest(trackerValidation.createTrackerZodSchema),
	trackerController.createTracker,
);

router.get("/:id", trackerController.getTrackerDetails);
router.patch(
	"/:id",
	validateRequest(trackerValidation.updateTrackerZodSchema),
	trackerController.updateTracker,
);
router.delete("/:id", trackerController.deleteTracker);

router.post(
	"/:id/log",
	validateRequest(trackerValidation.logDailyTrackerZodSchema),
	trackerController.logTrackerDay,
);

router.post(
	"/:id/settle",
	validateRequest(trackerValidation.settleTrackerZodSchema),
	trackerController.settleTracker,
);

export const trackerRoutes = router;
