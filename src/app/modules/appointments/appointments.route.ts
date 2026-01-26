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
  validateRequest(AppointmentsValidations.createAppointmentsSchema),
  AppointmentsControllers.createAppointmentsIntoDB,
);

router.get('/', auth('USER'), AppointmentsControllers.getAppointments);

router.patch(
  '/:id',
  auth('USER'),
  validateRequest(AppointmentsValidations.updateAppointmentsSchema),
  AppointmentsControllers.updateAppointmentIntoDB,
)
export const AppointmentsRoutes = router;
