import { Router } from 'express';

import { ServicesControllers } from './services.controller';
import { ServicesValidations } from './services.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = Router();

router.post(
  '/',
  auth('USER'),
  validateRequest(ServicesValidations.createServicesSchema),
  ServicesControllers.createServicesIntoDB,
);

export const ServicesRoutes = router;
