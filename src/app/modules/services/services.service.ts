import prisma from '../../libs/prisma';
import type { TCreateServicesPayload } from './services.interface';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';

const createServices = async (userId: string, payload: TCreateServicesPayload) => {

  // staff type exists check
  const staffExists = await prisma.staff.findFirst({
    where: {
      serviceType: payload.requiredStaffType,
      userId,
      status: 'Available',
    },
  });

  if (!staffExists) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `No available staff found for service type: ${payload.requiredStaffType}`
    );
  }

  const result = await prisma.service.create({ data: { ...payload, userId } });
  return result;
};

export const ServicesServices = {
  createServices,
};