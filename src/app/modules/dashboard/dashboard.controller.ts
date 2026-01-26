import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { DashboardServices } from './dashboard.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../helpers/pick';

const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ['targetDate']);
  const userId = req.user.userId;
  const result = await DashboardServices.getDashboardSummary(userId, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard summary fetched successfully',
    data: result,
  });
});

export const DashboardControllers = {
  getDashboardSummary,
};