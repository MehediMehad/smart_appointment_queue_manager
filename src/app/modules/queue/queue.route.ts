import { Router } from 'express';

import { QueueControllers } from './queue.controller';
import { QueueValidations } from './queue.validation';
import auth from '../../middlewares/auth';

const router = Router();

router.post('/assign', auth('USER'), QueueControllers.assignFromQueueToStaff);
router.get('/', auth('USER'), QueueControllers.getWaitingQueue);

export const QueueRoutes = router;
