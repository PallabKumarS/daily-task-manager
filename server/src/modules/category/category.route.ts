import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import * as categoryValidation from "./category.validation.js";
import * as categoryController from "./category.controller.js";

const router = Router();

router.use(auth());

router.get("/", categoryController.getCategories);
router.post(
  "/",
  validateRequest(categoryValidation.createCategoryValidationSchema),
  categoryController.createCategory
);
router.patch("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

export const categoryRoutes = router;
