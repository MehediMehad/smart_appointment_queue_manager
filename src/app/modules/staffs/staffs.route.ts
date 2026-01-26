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
router.get('/my', auth('USER', 'ADMIN'), StaffsControllers.getMyAllStaffs);

router.patch(
  '/:id',
  auth('USER', 'ADMIN'),
  validateRequest(StaffsValidations.updateStaffsSchema),
  StaffsControllers.updateStaffsIntoDB,
);

export const StaffsRoutes = router;
