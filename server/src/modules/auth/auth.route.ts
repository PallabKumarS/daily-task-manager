import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as authValidation from "./auth.validation.js";
import * as authController from "./auth.controller.js";

const router = Router();

router.post(
  "/register",
  validateRequest(authValidation.registerValidationSchema),
  authController.register
);

router.post(
  "/login",
  validateRequest(authValidation.loginValidationSchema),
  authController.login
);

router.post("/logout", authController.logout);

router.get("/me", auth(), authController.getMe);

router.patch(
  "/me",
  auth(),
  validateRequest(authValidation.updateProfileValidationSchema),
  authController.updateProfile
);

export const authRoutes = router;
