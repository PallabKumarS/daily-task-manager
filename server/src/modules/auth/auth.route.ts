import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as authController from "./auth.controller.js";
import * as authValidation from "./auth.validation.js";

const router = Router();

router.post(
	"/register",
	validateRequest(authValidation.registerValidationSchema),
	authController.register,
);

router.post("/login", validateRequest(authValidation.loginValidationSchema), authController.login);

router.post("/logout", authController.logout);

router.get("/google/restore-url", authController.getGoogleRestoreUrl);
router.get("/google/restore-status", authController.getGoogleRestoreStatus);
router.post("/restore-backup", authController.restoreBackup);

router.get("/me", auth(), authController.getMe);

router.patch(
	"/me",
	auth(),
	validateRequest(authValidation.updateProfileValidationSchema),
	authController.updateProfile,
);

export const authRoutes = router;
