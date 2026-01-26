import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { QueueServices } from './queue.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../helpers/pick';

const assignFromQueueToStaff = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const staffId = req.body.staffId;
  const result = await QueueServices.assignFromQueueToStaff(userId, staffId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Queue created successfully',
    data: result,
  });
});

export const QueueControllers = {
  assignFromQueueToStaff,
};