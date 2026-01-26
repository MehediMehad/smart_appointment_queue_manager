import express from 'express';

import { AuthsRoutes } from '../app/modules/auths/auths.route';
import { StaffsRoutes } from '../app/modules/staffs/staffs.route';
import { ServicesRoutes } from '../app/modules/services/services.route';

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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
