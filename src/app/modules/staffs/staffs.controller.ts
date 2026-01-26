import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { StaffsServices } from './staffs.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';

const createStaffsIntoDB = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const body = req.body;
  const result = await StaffsServices.createStaffs(userId, body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Staffs created successfully',
    data: result,
  });
});

export const StaffsControllers = {
  createStaffsIntoDB,
};
