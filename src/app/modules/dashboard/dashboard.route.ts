import { Router } from "express";
import { DashboardControllers } from "./dashboard.controller";
import auth from "../../middlewares/auth";
import { fileUploader } from "../../middlewares/s3MulterMiddleware";
import validateRequest from "../../middlewares/validateRequest";
import { DashboardValidations } from "./dashboard.validation";

const router = Router();

router.get('/summary', auth('USER', 'ADMIN'), DashboardControllers.getDashboardSummary);

export const DashboardRoutes = router;