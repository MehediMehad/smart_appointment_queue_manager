import { Router } from 'express';

import { StaffsControllers } from './staffs.controller';
import { StaffsValidations } from './staffs.validation';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';

const router = Router();

router.post(
  '/',
  auth('USER', 'ADMIN'),
  validateRequest(StaffsValidations.createStaffsSchema),
  StaffsControllers.createStaffsIntoDB,
);

router.get('/', auth('USER', 'ADMIN'), StaffsControllers.getAllStaffs);

export const StaffsRoutes = router;
