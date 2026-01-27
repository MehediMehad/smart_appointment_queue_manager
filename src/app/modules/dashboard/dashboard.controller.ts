import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { DashboardServices } from './dashboard.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

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

const getRecentActivityLogs = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const filters = pick(req.query, ['staffId', 'appointmentId']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const result = await DashboardServices.getRecentActivityLogs(userId, filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Recent activity logs fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const DashboardControllers = {
  getDashboardSummary,
  getRecentActivityLogs,
};
