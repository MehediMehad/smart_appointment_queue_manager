import { startOfDay, endOfDay } from 'date-fns';
import prisma from '../../libs/prisma';

type TFilterOptions = {
  targetDate?: string;
};

const getDashboardSummary = async (userId: string, filter: TFilterOptions) => {
  const { targetDate } = filter;

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


export const DashboardServices = {
  getDashboardSummary,
};