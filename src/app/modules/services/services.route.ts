import { Router } from "express";
import { ServicesControllers } from "./services.controller";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { ServicesValidations } from "./services.validation";

const router = Router();

router.post(
  "/",
  auth("USER"),
  validateRequest(ServicesValidations.createServicesSchema),
  ServicesControllers.createServicesIntoDB,
);

export const ServicesRoutes = router;