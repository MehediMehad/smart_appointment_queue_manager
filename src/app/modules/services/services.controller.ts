import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { ServicesServices } from './services.service';
import catchAsync from '../../helpers/catchAsync';
import sendResponse from '../../utils/sendResponse';

const createServicesIntoDB = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const body = req.body;
  const result = await ServicesServices.createServices(userId, body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Services created successfully',
    data: result,
  });
});

export const ServicesControllers = {
  createServicesIntoDB,
};
