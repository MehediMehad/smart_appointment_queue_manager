import express from 'express';

import { AuthsRoutes } from '../app/modules/auths/auths.route';
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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
