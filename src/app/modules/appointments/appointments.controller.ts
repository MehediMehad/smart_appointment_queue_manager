import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { AppointmentsServices } from './appointments.service';
import catchAsync from '../../helpers/catchAsync';
import pick from '../../helpers/pick';
import sendResponse from '../../utils/sendResponse';

const createAppointmentsIntoDB = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const body = req.body;
  const result = await AppointmentsServices.createAppointments(userId, body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Appointments created successfully',
    data: result,
  });
});

const getAppointments = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const filters = pick(req.query, ['searchTerm', 'status', 'date', 'staffId']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const result = await AppointmentsServices.getAppointments(userId, filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Appointments fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

export const AppointmentsControllers = {
  createAppointmentsIntoDB,
  getAppointments,
};
