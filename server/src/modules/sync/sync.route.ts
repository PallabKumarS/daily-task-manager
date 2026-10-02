import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as syncValidation from "./sync.validation.js";
import * as syncController from "./sync.controller.js";

const router = Router();

router.get("/google/callback", syncController.handleGoogleOAuthCallback);

router.use(auth());

router.get("/status", syncController.getSyncStatus);
router.get("/auth-url", syncController.getAuthUrl);
router.post(
  "/connect",
  validateRequest(syncValidation.connectGoogleValidationSchema),
  syncController.connectGoogle
);
router.post("/upload", syncController.uploadToDrive);
router.get("/backups", syncController.listDriveBackups);
router.post(
  "/restore",
  validateRequest(syncValidation.restoreValidationSchema),
  syncController.restoreFromDrive
);
router.post("/disconnect", syncController.disconnectGoogle);
router.post("/simulate", syncController.simulateSync);

export const syncRoutes = router;
