import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as categoryController from "./category.controller.js";
import * as categoryValidation from "./category.validation.js";

const router = Router();

router.use(auth());

router.get("/", categoryController.getCategories);
router.post(
	"/",
	validateRequest(categoryValidation.createCategoryValidationSchema),
	categoryController.createCategory,
);
router.patch(
	"/:id",
	validateRequest(categoryValidation.updateCategoryValidationSchema),
	categoryController.updateCategory,
);
router.delete("/:id", categoryController.deleteCategory);

export const categoryRoutes = router;
