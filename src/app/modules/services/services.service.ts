import type { Prisma } from '@prisma/client';
import httpStatus from 'http-status';

import type { TCreateServicesPayload } from './services.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';

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
      `No available staff found for service type: ${payload.requiredStaffType}`,
    );
  }

  const result = await prisma.service.create({ data: { ...payload, userId } });
  return result;
};

interface TFilterOptions {
  searchTerm?: string;
  type?: 'my_services' | 'all_services';
}

const getAllServices = async (
  userId: string,
  filters: TFilterOptions,
  options: IPaginationOptions,
) => {
  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, type = 'all_services' } = filters;

  // Build dynamic where clause
  const whereClause: Prisma.ServiceWhereInput = {};

  if (type === 'my_services') {
    whereClause.userId = userId;
  }

  // search (title, category)
  if (searchTerm) {
    whereClause.OR = [
      {
        name: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
    ];
  }

  const result = await prisma.service.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      requiredStaffType: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const total = await prisma.service.count({
    where: whereClause,
  });

  // Pagination meta
  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  };

  return {
    meta,
    data: result,
  };
};

export const ServicesServices = {
  createServices,
  getAllServices,
};
