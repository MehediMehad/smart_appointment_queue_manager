import type { Request, Response } from 'express';
import httpStatus from 'http-status';

import { AppointmentsServices } from './appointments.service';
import catchAsync from '../../helpers/catchAsync';
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

export const AppointmentsControllers = {
  createAppointmentsIntoDB,
};
