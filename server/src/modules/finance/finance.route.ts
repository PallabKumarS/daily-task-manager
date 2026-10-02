import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as financeValidation from "./finance.validation.js";
import * as financeController from "./finance.controller.js";

const router = Router();

router.use(auth());

router.get("/", financeController.getTransactions);
router.get("/analytics", financeController.getCumulativeAnalytics);
router.post(
  "/",
  validateRequest(financeValidation.createTransactionValidationSchema),
  financeController.createTransaction
);
router.patch(
  "/:id",
  validateRequest(financeValidation.updateTransactionValidationSchema),
  financeController.updateTransaction
);
router.delete("/:id", financeController.deleteTransaction);

export const financeRoutes = router;
