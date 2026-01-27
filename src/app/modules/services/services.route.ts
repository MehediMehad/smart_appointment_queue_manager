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

router.get('/', auth('USER'), ServicesControllers.getAllServices);

router.patch(
  '/:id',
  auth('USER'),
  validateRequest(ServicesValidations.updateServicesSchema),
  ServicesControllers.updateServicesIntoDB,
);

router.delete('/:id', auth('USER'), ServicesControllers.deleteServicesIntoDB);

export const ServicesRoutes = router;
