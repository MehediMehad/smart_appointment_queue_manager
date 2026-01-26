import type { AppointmentStatusEnum, Prisma } from '@prisma/client';
import { addMinutes, isSameDay, parseISO } from 'date-fns';
import httpStatus from 'http-status';

import type { TCreateAppointmentsPayload } from './appointments.interface';
import ApiError from '../../errors/ApiError';
import { paginationHelper } from '../../helpers/paginationHelper';
import type { IPaginationOptions } from '../../interface/pagination.type';
import prisma from '../../libs/prisma';

// Helper: Check if two time slots overlap
const timesOverlap = (
  existingStart: Date,
  existingEnd: Date,
  newStart: Date,
  newEnd: Date,
): boolean => newStart < existingEnd && existingStart < newEnd;

const tryAutoAssignFromQueue = async (
  userId: string,
  staffType?: string, // optional filter
  maxAssignments: number = 10,
): Promise<{ assignedCount: number; logs: string[] }> => {
  const logs: string[] = [];

  // 1. Find all WAITING appointments (oldest first)
  const waitingAppointments = await prisma.appointment.findMany({
    where: {
      userId,
      status: 'Waiting',
      service: staffType ? { requiredStaffType: staffType } : undefined,
    },
    orderBy: { dateTime: 'asc' }, // earliest first
    take: maxAssignments,
    include: {
      service: true,
    },
  });

  if (waitingAppointments.length === 0) {
    return { assignedCount: 0, logs: ['No waiting appointments found'] };
  }

  let assignedCount = 0;

  for (const appt of waitingAppointments) {
    const appointmentStart = parseISO(appt.dateTime.toISOString());
    const appointmentEnd = addMinutes(appointmentStart, appt.service.durationMinutes);

    // 2. Find currently eligible staff for this appointment
    const eligibleStaff = await prisma.staff.findMany({
      where: {
        userId,
        serviceType: appt.service.requiredStaffType,
        status: 'Available',
      },
      include: {
        appointments: {
          where: {
            status: { in: ['Scheduled'] }, // only active/conflicting ones
          },
          include: {
            service: true,
          },
        },
      },
      orderBy: [
        // Prefer staff with fewest appointments today (simple load balancing)
        { appointments: { _count: 'asc' } },
        { name: 'asc' },
      ],
    });

    let assigned = false;

    for (const staff of eligibleStaff) {
      // Count today's appointments
      const todayAppointments = staff.appointments.filter((app) =>
        isSameDay(parseISO(app.dateTime.toISOString()), appointmentStart),
      );

      if (todayAppointments.length >= staff.dailyCapacity) {
        continue;
      }

      // Check time conflict
      let conflict = false;
      for (const existing of todayAppointments) {
        const exStart = parseISO(existing.dateTime.toISOString());
        const exEnd = addMinutes(exStart, existing.service?.durationMinutes || 30);

        if (timesOverlap(exStart, exEnd, appointmentStart, appointmentEnd)) {
          conflict = true;
          break;
        }
      }

      if (conflict) continue;

      // ── We can assign! ──
      await prisma.$transaction(async (tx) => {
        // Update appointment
        await tx.appointment.update({
          where: { id: appt.id },
          data: {
            staffId: staff.id,
            status: 'Scheduled',
          },
        });

        // Log
        const message = `Appointment for "${appt.customerName}" (from queue) auto-assigned to ${staff.name}`;

        await tx.activityLog.create({
          data: {
            userId,
            staffId: staff.id,
            appointmentId: appt.id,
            message,
            action: 'QUEUE_TO_STAFF',
          },
        });

        logs.push(message);
      });

      assigned = true;
      assignedCount++;
      break; // assigned → move to next waiting appointment
    }

    // If no staff could take it → stop for this one (but continue to next)
    if (!assigned) {
      logs.push(
        `Could not assign queued appointment for "${appt.customerName}" — no suitable staff available right now`,
      );
    }
  }

  return {
    assignedCount,
    logs,
  };
};

const createAppointments = async (userId: string, payload: TCreateAppointmentsPayload) => {
  const {
    customerName,
    customerPhone,
    customerEmail,
    serviceId,
    dateTime, // ISO string e.g. "2025-02-15T10:30:00.000Z"
  } = payload;

  // 1. Validate & fetch service
  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      userId,
    },
  });

  if (!service) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found or does not belong to you');
  }

  const appointmentStart = parseISO(dateTime);
  const appointmentEnd = addMinutes(appointmentStart, service.durationMinutes);

  // 2. Find all potentially eligible staff (same type + not on leave)
  const eligibleStaff = await prisma.staff.findMany({
    where: {
      userId,
      serviceType: service.requiredStaffType,
      status: 'Available', // not OnLeave
    },
    include: {
      appointments: {
        where: {
          status: { in: ['Scheduled', 'Waiting'] }, // only count active ones
          OR: [
            // same day appointments only (optimization)
            { dateTime: { gte: appointmentStart } },
            { dateTime: { lte: appointmentEnd } },
          ],
        },
        include: {
          service: true,
        },
      },
    },
  });

  if (eligibleStaff.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `No available staff found for type: ${service.requiredStaffType}`,
    );
  }

  // 3. Check daily capacity & time conflicts → find best candidate
  let selectedStaff = null;
  const staffTodayCount: Record<string, number> = {};

  for (const staff of eligibleStaff) {
    // Count how many appointments this staff has TODAY
    const todayAppointments = staff.appointments.filter((app) =>
      isSameDay(parseISO(app.dateTime.toISOString()), appointmentStart),
    );

    const todayCount = todayAppointments.length;
    staffTodayCount[staff.id] = todayCount;

    if (todayCount >= staff.dailyCapacity) {
      continue; // skip — full today
    }

    // Check time conflict
    let hasConflict = false;

    for (const existing of todayAppointments) {
      const existingStart = parseISO(existing.dateTime.toISOString());
      const existingEnd = addMinutes(existingStart, existing.service.durationMinutes);

      if (timesOverlap(existingStart, existingEnd, appointmentStart, appointmentEnd)) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      selectedStaff = staff;
      break; // found first available staff → good enough (can be improved with load balancing later)
    }
  }

  let appointmentStatus: 'Scheduled' | 'Waiting';
  let assignedStaffId: string | null = null;
  let logMessage: string;

  if (selectedStaff) {
    appointmentStatus = 'Scheduled';
    assignedStaffId = selectedStaff.id;

    logMessage = `Appointment for "${customerName}" scheduled with ${selectedStaff.name} (${staffTodayCount[selectedStaff.id] + 1}/${selectedStaff.dailyCapacity})`;
  } else {
    appointmentStatus = 'Waiting';
    assignedStaffId = null;

    logMessage = `Appointment for "${customerName}" added to waiting queue (no available staff at selected time)`;
  }

  // 4. Create the appointment
  const newAppointment = await prisma.appointment.create({
    data: {
      customerName,
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      serviceId,
      userId,
      staffId: assignedStaffId,
      dateTime: appointmentStart,
      status: appointmentStatus,
    },
  });

  // 5. Create activity log
  await prisma.activityLog.create({
    data: {
      userId,
      staffId: assignedStaffId,
      appointmentId: newAppointment.id,
      message: logMessage,
      action: assignedStaffId ? 'CREATE' : 'QUEUE',
    },
  });

  // Optional: you can trigger auto-assign-from-queue logic here if status = Waiting
  // await tryAutoAssignFromQueue(userId, service.requiredStaffType);

  return {
    ...newAppointment,
    message: logMessage,
    status: newAppointment.status,
    staffName: selectedStaff?.name || null,
  };
};

type TFilterOptions = {
  date?: string; // format: "2026-01-26"
  staffId?: string;
  status?: AppointmentStatusEnum;
  searchTerm?: string;
};

const getAppointments = async (
  userId: string,
  filters: TFilterOptions = {},
  options: IPaginationOptions,
) => {
  const { limit, page, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);

  const { date, staffId, status, searchTerm } = filters;

  // Build where clause
  const where: Prisma.AppointmentWhereInput = {
    userId,
  };

  // 1. Date filter (specific day)
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    where.dateTime = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  // 2. Staff filter
  if (staffId) {
    where.staffId = staffId;
  }

  // 3. Status filter (optional)
  if (status) {
    where.status = status;
  }

  // 4. Customer name search (partial match)
  if (searchTerm && searchTerm.trim()) {
    where.customerName = {
      contains: searchTerm.trim(),
      mode: 'insensitive', // case-insensitive
    };
  }

  // Default sort: newest first (or upcoming first)
  const orderBy = sortBy
    ? { [sortBy]: sortOrder || 'desc' }
    : date
      ? { dateTime: 'asc' } // on specific date → chronological
      : { dateTime: 'desc' }; // otherwise → newest first

  // Fetch total count for pagination
  const total = await prisma.appointment.count({ where });

  // Fetch paginated appointments
  const appointments = await prisma.appointment.findMany({
    where,
    // orderBy,
    skip,
    take: limit,
    include: {
      service: {
        select: {
          name: true,
          durationMinutes: true,
          requiredStaffType: true,
        },
      },
      staff: {
        select: {
          id: true,
          name: true,
          serviceType: true,
          dailyCapacity: true,
          status: true,
        },
      },
    },
  });

  // Optional: enrich with extra info (e.g. time slot end, load info)
  const enrichedAppointments = appointments.map((appt) => {
    const startTime = appt.dateTime;
    const endTime = new Date(
      startTime.getTime() + (appt.service?.durationMinutes || 30) * 60 * 1000,
    );

    return {
      ...appt,
      serviceName: appt.service?.name,
      staffName: appt.staff?.name || null,
      durationMinutes: appt.service?.durationMinutes,
      timeSlot: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
      isOverdue: appt.status === 'Scheduled' && startTime < new Date(),
    };
  });

  return {
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: enrichedAppointments,
  };
};

export const AppointmentsServices = {
  createAppointments,
  getAppointments,
};
