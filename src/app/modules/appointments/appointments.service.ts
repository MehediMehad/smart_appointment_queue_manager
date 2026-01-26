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
  const orderBy: Prisma.AppointmentOrderByWithRelationInput = sortBy
    ? { [sortBy]: (sortOrder || 'desc') as Prisma.SortOrder }
    : date
      ? { dateTime: 'asc' }
      : { dateTime: 'desc' };

  // Fetch total count for pagination
  const total = await prisma.appointment.count({ where });

  // Fetch paginated appointments
  const appointments = await prisma.appointment.findMany({
    where,
    orderBy,
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

type TUpdateAppointment = {
  customerName?: string;
  serviceId?: string;
  dateTime?: string; // ISO string "2026-01-26T11:30:00.000Z"
  staffId?: string | null; // allow explicit null to move to queue
  status?: 'Scheduled' | 'Waiting' | 'Completed' | 'Cancelled' | 'NoShow';
};

const updateAppointmentIntoDB = async (
  userId: string,
  appointmentId: string,
  payload: TUpdateAppointment,
) => {
  // 1️⃣ Fetch existing appointment
  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId },
    include: {
      service: true,
      staff: true,
    },
  });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  // 2️⃣ Final values resolve
  const finalServiceId = payload.serviceId ?? existing.serviceId;
  const finalDateTimeStr = payload.dateTime ?? existing.dateTime.toISOString();
  const finalDateTime = parseISO(finalDateTimeStr);
  const finalStaffId = payload.staffId !== undefined ? payload.staffId : existing.staffId;

  // 3️⃣ Fetch service if changed
  let service = existing.service;
  if (payload.serviceId && payload.serviceId !== existing.serviceId) {
    const newService = await prisma.service.findFirst({
      where: { id: payload.serviceId, userId },
    });

    if (!newService) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or unauthorized service');
    }

    service = newService;
  }

  const duration = service.durationMinutes;
  const newEndTime = addMinutes(finalDateTime, duration);

  // 4️⃣ Status priority logic
  let newStatus: AppointmentStatusEnum = existing.status;

  // Manual override first (highest priority)
  if (payload.status && ['Cancelled', 'Completed', 'NoShow'].includes(payload.status)) {
    newStatus = payload.status;
  }

  let selectedStaff: any = null;

  // Auto logic only if NOT cancelled/completed
  if (!['Cancelled', 'Completed', 'NoShow'].includes(newStatus)) {
    if (finalStaffId) {
      // ── Validate staff ──
      selectedStaff = await prisma.staff.findFirst({
        where: {
          id: finalStaffId,
          userId,
          status: 'Available',
        },
        include: {
          appointments: {
            where: {
              id: { not: appointmentId },
              status: { in: ['Scheduled'] },
            },
            include: {
              service: true,
            },
          },
        },
      });

      if (!selectedStaff) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Selected staff not found or not available');
      }

      // A️⃣ Daily capacity check
      const todayAppointments = selectedStaff.appointments.filter(
        (app: (typeof selectedStaff.appointments)[number]) =>
          isSameDay(parseISO(app.dateTime.toISOString()), finalDateTime),
      );

      if (todayAppointments.length >= selectedStaff.dailyCapacity) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `${selectedStaff.name} has reached daily capacity (${todayAppointments.length}/${selectedStaff.dailyCapacity})`,
        );
      }

      // B️⃣ Time conflict check
      for (const app of todayAppointments) {
        const exStart = parseISO(app.dateTime.toISOString());
        const exEnd = addMinutes(exStart, app.service.durationMinutes);

        if (timesOverlap(exStart, exEnd, finalDateTime, newEndTime)) {
          throw new ApiError(
            httpStatus.CONFLICT,
            'This staff member already has an appointment at the selected time',
          );
        }
      }

      newStatus = 'Scheduled';
    } else {
      // No staff → queue
      newStatus = 'Waiting';
    }
  }

  // Transaction update
  const updated = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        customerName: payload.customerName ?? existing.customerName,
        serviceId: finalServiceId,
        dateTime: finalDateTime,
        staffId: finalStaffId,
        status: newStatus,
      },
    });

    // Activity log
    const action =
      newStatus === 'Cancelled'
        ? 'CANCEL'
        : newStatus === 'Completed'
          ? 'COMPLETE'
          : finalStaffId
            ? existing.staffId
              ? 'EDIT'
              : 'QUEUE_TO_STAFF'
            : 'QUEUED';

    const changes: string[] = [];
    if (payload.dateTime) changes.push('time updated');
    if (payload.staffId !== undefined) {
      changes.push(finalStaffId ? `assigned to ${selectedStaff?.name}` : 'moved to queue');
    }
    if (payload.status) changes.push(`status → ${newStatus}`);

    const logMessage = `Appointment for "${appt.customerName}" updated: ${
      changes.join(', ') || 'minor changes'
    }`;

    await tx.activityLog.create({
      data: {
        userId,
        staffId: finalStaffId ?? undefined,
        appointmentId: appt.id,
        action,
        message: logMessage,
      },
    });

    return appt;
  });

  // If staff removed → try to fill queue
  if (existing.staffId && !finalStaffId) {
    await tryAutoAssignFromQueue(userId, existing.service.requiredStaffType, 5);
  }

  return updated;
};

const cancelAppointment = async (userId: string, appointmentId: string) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, userId },
    include: { service: true, staff: true },
  });

  if (!appointment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Appointment not found');
  }

  if (appointment.status === 'Completed' || appointment.status === 'NoShow') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot cancel completed or no-show appointments');
  }

  await prisma.$transaction(async (tx) => {
    // Soft-delete style: update status
    const cancelled = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: 'Cancelled' },
    });

    await tx.activityLog.create({
      data: {
        userId,
        staffId: appointment.staffId ?? undefined,
        appointmentId,
        message: `Appointment for "${appointment.customerName}" was cancelled`,
        action: 'CANCEL',
      },
    });

    return cancelled;
  });

  // If it was scheduled → that staff slot is now free → try to assign from queue
  if (appointment.status === 'Scheduled' && appointment.staffId) {
    const staff = await prisma.staff.findUnique({
      where: { id: appointment.staffId },
      select: { serviceType: true },
    });

    if (staff) {
      await tryAutoAssignFromQueue(userId, staff.serviceType, 5);
    }
  }

  return { message: 'Appointment cancelled successfully', id: appointmentId };
};

export const AppointmentsServices = {
  createAppointments,
  getAppointments,
  updateAppointmentIntoDB,
  cancelAppointment,
};
