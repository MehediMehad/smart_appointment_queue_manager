import { Router } from 'express';

import { DashboardControllers } from './dashboard.controller';
import auth from '../../middlewares/auth';

const router = Router();

router.get('/summary', auth('USER', 'ADMIN'), DashboardControllers.getDashboardSummary);
router.get(
  '/recent-activity-logs',
  auth('USER', 'ADMIN'),
  DashboardControllers.getRecentActivityLogs,
);

export const DashboardRoutes = router;
