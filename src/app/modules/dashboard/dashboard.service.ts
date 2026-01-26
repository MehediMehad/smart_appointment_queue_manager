import { startOfDay, endOfDay } from 'date-fns';
import prisma from '../../libs/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../helpers/paginationHelper';
import { Prisma } from '@prisma/client';

type TFilterOptions = {
  targetDate?: string;
};

const getDashboardSummary = async (userId: string, filter: TFilterOptions) => {
  const { targetDate } = filter; // ex: '2023-01-01'

  const today = targetDate ? new Date(targetDate) : new Date();
  const start = startOfDay(today);
  const end = endOfDay(today);

  // ── 1. Today's appointments stats ──
  const todayAppointments = await prisma.appointment.findMany({
    where: {
      userId,
      dateTime: {
        gte: start,
        lte: end,
      },
    },
    select: {
      status: true,
    },
  });

  const totalToday = todayAppointments.length;

  const completed = todayAppointments.filter(a => a.status === 'Completed').length;
  const pending = todayAppointments.filter(a =>
    ['Scheduled', 'Waiting'].includes(a.status)
  ).length;

  // ── 2. Waiting queue count ──
  const waitingQueue = await prisma.appointment.count({
    where: {
      userId,
      status: 'Waiting',
    },
  });

  // ── 3. Staff load summary ──
  const staffs = await prisma.staff.findMany({
    where: {
      userId,
      // Optionally: status: 'Available'  → comment out if you want to show everyone
    },
    include: {
      appointments: {
        where: {
          dateTime: {
            gte: start,
            lte: end,
          },
          status: { in: ['Scheduled'] }, // only count confirmed ones
        },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const staffLoad = staffs.map(staff => {
    const loadCount = staff.appointments.length;
    const isBooked = loadCount >= staff.dailyCapacity;

    return {
      name: staff.name,
      load: `${loadCount}/${staff.dailyCapacity}`,
      status: isBooked ? 'BOOKED' : 'OK',
      serviceType: staff.serviceType, // optional — nice to have
    };
  });

  return {
    totalToday,
    completed,
    pending,
    waitingQueue,
    staffLoad,
    date: today.toISOString().split('T')[0], // for frontend clarity
  };
};


type TActivityLogFilter = {
  limit?: number;
  staffId?: string;     // optional
  appointmentId?: string; // optional
};

const getRecentActivityLogs = async (
  userId: string,
  filter: TActivityLogFilter,
  options: IPaginationOptions,
) => {
  const { staffId, appointmentId } = filter;
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);

  const whereClause: Prisma.ActivityLogWhereInput = {
    userId,
    ...(staffId && { staffId }),
    ...(appointmentId && { appointmentId }),
  };

  const logs = await prisma.activityLog.findMany({
    where: whereClause,
    skip,
    take: Math.min(limit, 20),
    orderBy: {
      createdAt: 'desc', // recent first
    },
    include: {
      staff: {
        select: { name: true },
      },
      appointment: {
        select: { customerName: true },
      },
    },
  });

  const total = await prisma.activityLog.count({
    where: whereClause,
  });

  const formatted = logs.map(log => {
    const timeStr = log.createdAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      id: log.id,
      time: timeStr,
      message: log.message,
      action: log.action || null,
      staffName: log.staff?.name || null,
      customerName: log.appointment?.customerName || null,
      createdAt: log.createdAt.toISOString(),
    };
  });

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
    data: formatted,
  };
};


export const DashboardServices = {
  getDashboardSummary,
  getRecentActivityLogs,
};