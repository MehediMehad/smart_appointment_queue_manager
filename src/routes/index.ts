import express from 'express';

import { AppointmentsRoutes } from '../app/modules/appointments/appointments.route';
import { AuthsRoutes } from '../app/modules/auths/auths.route';
import { DashboardRoutes } from '../app/modules/dashboard/dashboard.route';
import { QueueRoutes } from '../app/modules/queue/queue.route';
import { ServicesRoutes } from '../app/modules/services/services.route';
import { StaffsRoutes } from '../app/modules/staffs/staffs.route';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthsRoutes,
  },
  {
    path: '/staff',
    route: StaffsRoutes,
  },
  {
    path: '/services',
    route: ServicesRoutes,
  },
  {
    path: '/appointments',
    route: AppointmentsRoutes,
  },
  {
    path: '/queue',
    route: QueueRoutes,
  },
  {
    path: '/dashboard',
    route: DashboardRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
