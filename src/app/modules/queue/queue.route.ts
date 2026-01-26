import { Router } from "express";
import { QueueControllers } from "./queue.controller";
import auth from "../../middlewares/auth";
import { fileUploader } from "../../middlewares/s3MulterMiddleware";
import validateRequest from "../../middlewares/validateRequest";
import { QueueValidations } from "./queue.validation";

const router = Router();

router.post("/assign", auth("USER"), QueueControllers.assignFromQueueToStaff);

export const QueueRoutes = router;