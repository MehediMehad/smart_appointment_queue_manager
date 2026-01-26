import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { QueueServices } from './queue.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

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

const getWaitingQueue = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const filters = pick(req.query, ['serviceType']);
  const result = await QueueServices.getWaitingQueue(userId, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Queue fetched successfully',
    data: result,
  });
});

export const QueueControllers = {
  assignFromQueueToStaff,
  getWaitingQueue,
};
