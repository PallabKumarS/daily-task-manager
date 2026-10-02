import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.route.js";
import { routineRoutes } from "../modules/routine/routine.route.js";
import { taskRoutes } from "../modules/task/task.route.js";
import { financeRoutes } from "../modules/finance/finance.route.js";
import { syncRoutes } from "../modules/sync/sync.route.js";
import { categoryRoutes } from "../modules/category/category.route.js";
import { trackerRoutes } from "../modules/tracker/tracker.route.js";

const router = Router();

const moduleRoutes = [
  { path: "/auth", route: authRoutes },
  { path: "/routines", route: routineRoutes },
  { path: "/tasks", route: taskRoutes },
  { path: "/finances", route: financeRoutes },
  { path: "/sync", route: syncRoutes },
  { path: "/categories", route: categoryRoutes },
  { path: "/trackers", route: trackerRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export const applicationRoutes = router;
