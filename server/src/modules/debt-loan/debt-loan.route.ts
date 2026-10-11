import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as debtLoanController from "./debt-loan.controller.js";
import * as debtLoanValidation from "./debt-loan.validation.js";

const router = Router();

router.use(auth());

router.get("/", debtLoanController.getDebtsLoans);
router.post(
	"/",
	validateRequest(debtLoanValidation.createDebtLoanZodSchema),
	debtLoanController.createDebtLoan,
);
router.get("/:id", debtLoanController.getDebtLoanDetails);
router.patch(
	"/:id",
	validateRequest(debtLoanValidation.updateDebtLoanZodSchema),
	debtLoanController.updateDebtLoan,
);
router.delete("/:id", debtLoanController.deleteDebtLoan);

router.post(
	"/:id/repay",
	validateRequest(debtLoanValidation.recordRepaymentZodSchema),
	debtLoanController.recordRepayment,
);

router.delete("/:id/repayments/:repaymentId", debtLoanController.deleteRepayment);

export const debtLoanRoutes = router;
