import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { ServicesServices } from './services.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
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

const getAllServices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const filters = pick(req.query, ['searchTerm', 'type']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const result = await ServicesServices.getAllServices(userId, filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Services fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const ServicesControllers = {
  createServicesIntoDB,
  getAllServices,
};
