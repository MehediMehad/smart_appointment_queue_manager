import { Router } from 'express';

import { AppointmentsControllers } from './appointments.controller';
import { AppointmentsValidations } from './appointments.validation';
import auth from '../../middlewares/auth';
import { fileUploader } from '../../middlewares/s3MulterMiddleware';
import validateRequest from '../../middlewares/validateRequest';

const router = Router();

router.post(
  '/',
  auth('USER'),
  fileUploader.uploadFields,
  validateRequest(AppointmentsValidations.createAppointmentsSchema, {
    image: 'single',
  }),
  AppointmentsControllers.createAppointmentsIntoDB,
);

router.get('/', auth('USER'), AppointmentsControllers.getAppointments);
export const AppointmentsRoutes = router;
