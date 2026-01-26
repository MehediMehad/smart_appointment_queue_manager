import httpStatus from 'http-status';

import type { TCreateStaffsPayload } from './staffs.interface';
import ApiError from '../../errors/ApiError';
import prisma from '../../libs/prisma';

const createStaffs = async (usrId: string, payload: TCreateStaffsPayload) => {
  const user = await prisma.user.findUnique({ where: { id: usrId } });

  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

  const result = await prisma.staff.create({ data: { ...payload, userId: usrId } });

  return result;
};

export const StaffsServices = {
  createStaffs,
};
