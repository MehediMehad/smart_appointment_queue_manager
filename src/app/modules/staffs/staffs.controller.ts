import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { StaffsServices } from './staffs.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
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

const getAllStaffs = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const filters = pick(req.query, ['searchTerm', 'status']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const result = await StaffsServices.getAllStaffs(userId, filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Staffs fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getMyAllStaffs = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const filters = pick(req.query, ['searchTerm', 'status']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const result = await StaffsServices.getMyAllStaffs(userId, filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My Staffs fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const StaffsControllers = {
  createStaffsIntoDB,
  getAllStaffs,
  getMyAllStaffs,
};
