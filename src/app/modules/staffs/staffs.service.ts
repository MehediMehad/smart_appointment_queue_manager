import type { Prisma, StaffStatusEnum } from '@prisma/client';
import httpStatus from 'http-status';

import type { TCreateStaffsPayload, TUpdateStaffsPayload } from './staffs.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';

const createStaffsIntoDB = async (usrId: string, payload: TCreateStaffsPayload) => {
  const user = await prisma.user.findUnique({ where: { id: usrId } });

  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

  const result = await prisma.staff.create({ data: { ...payload, userId: usrId } });

  return result;
};

type TFilterOptions = {
  searchTerm?: string;
  status?: StaffStatusEnum;
  type?: 'my_staffs' | 'all_staffs';
};

const getAllStaffs = async (
  userId: string,
  filters: TFilterOptions,
  options: IPaginationOptions,
) => {
  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, status, type = 'all_staffs' } = filters;

  // Build dynamic where clause
  const whereClause: Prisma.StaffWhereInput = {};

  // filters
  if (type === 'my_staffs') {
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

  // filters (status)
  if (status) {
    whereClause.status = status;
  }

  // Get paginated data
  const staffs = await prisma.staff.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder, // default newest
    },
    select: {
      id: true,
      name: true,
      serviceType: true,
      dailyCapacity: true,
      status: true,
      createdAt: true,
    },
  });

  //  Get total count
  const total = await prisma.staff.count({
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
    data: staffs,
  };
};

const getEligibleStaffs = async (
  userId: string,
  filters: TFilterOptions,
  options: IPaginationOptions,
) => {
  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
  const { searchTerm, status = 'Available', type = 'all_staffs' } = filters;

  // Build dynamic where clause
  const whereClause: Prisma.StaffWhereInput = {};

  // filters
  if (type === 'my_staffs') {
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

  // filters (status)
  if (status) {
    whereClause.status = status;
  }

  // Get paginated data
  const staffs = await prisma.staff.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder, // default newest
    },
    select: {
      id: true,
      name: true,
      serviceType: true,
      dailyCapacity: true,
      status: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  //  Get total count
  const total = await prisma.staff.count({
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
    data: staffs,
  };
};

const updateStaffsIntoDB = async (
  userId: string,
  staffId: string,
  payload: TUpdateStaffsPayload,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });

  if (!staff) throw new ApiError(httpStatus.NOT_FOUND, 'Staff not found');

  const result = await prisma.staff.update({ where: { id: staffId }, data: payload });

  return result;
};
export const StaffsServices = {
  createStaffsIntoDB,
  getAllStaffs,
  getEligibleStaffs,
  updateStaffsIntoDB,
};
