import { addMinutes, isSameDay, parseISO } from 'date-fns';
import httpStatus from 'http-status';

import ApiError from '../../errors/ApiError';
import prisma from '../../libs/prisma';
import { timesOverlap } from '../appointments/appointments.service';

type TQueueFilter = {
  serviceType?: string; // optional: only show queue for specific staff type
};

const getWaitingQueue = async (userId: string, filter: TQueueFilter = {}) => {
  const { serviceType } = filter;

  const where: any = {
    userId,
    status: 'Waiting',
  };

  if (serviceType) {
    where.service = {
      requiredStaffType: serviceType,
    };
  }

  const waitingAppointments = await prisma.appointment.findMany({
    where,
    orderBy: { dateTime: 'asc' }, // oldest first → queue order
    include: {
      service: {
        select: {
          name: true,
          durationMinutes: true,
          requiredStaffType: true,
        },
      },
      staff: false, // no staff assigned yet
    },
  });

  // Enrich with queue position
  const queueWithPosition = waitingAppointments.map((appt, index) => ({
    id: appt.id,
    position: index + 1,
    customerName: appt.customerName,
    customerPhone: appt.customerPhone || null,
    serviceName: appt.service.name,
    requiredStaffType: appt.service.requiredStaffType,
    requestedDateTime: appt.dateTime.toISOString(),
    durationMinutes: appt.service.durationMinutes,
    createdAt: appt.createdAt.toISOString(),
    isOverdue: appt.dateTime < new Date(),
  }));

  return {
    count: queueWithPosition.length,
    queue: queueWithPosition,
  };
};

type TAssignFromQueuePayload = {
  staffId: string;
};

const assignFromQueueToStaff = async (userId: string, payload: TAssignFromQueuePayload) => {
  const { staffId } = payload;

  // 1. Validate staff exists and is available
  const staff = await prisma.staff.findFirst({
    where: {
      id: staffId,
      userId,
      status: 'Available',
    },
    include: {
      appointments: {
        where: {
          status: 'Scheduled',
        },
        include: {
          service: true,
        },
      },
    },
  });

  if (!staff) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Staff not found or not available');
  }

  // 2. Get all waiting appointments that this staff type can handle
  const eligibleWaiting = await prisma.appointment.findMany({
    where: {
      userId,
      status: 'Waiting',
      service: {
        requiredStaffType: staff.serviceType,
      },
    },
    orderBy: { dateTime: 'asc' }, // earliest first
    take: 5, // small limit — we only need the first few
    include: {
      service: {
        select: { durationMinutes: true, name: true },
      },
    },
  });

  if (eligibleWaiting.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No waiting appointments eligible for this staff type',
    );
  }

  let assignedAppointment = null;
  const conflictFound = false;

  for (const appt of eligibleWaiting) {
    const start = parseISO(appt.dateTime.toISOString());
    const end = addMinutes(start, appt.service.durationMinutes);

    // Check capacity today
    const todayApps = staff.appointments.filter((a) =>
      isSameDay(parseISO(a.dateTime.toISOString()), start),
    );

    if (todayApps.length >= staff.dailyCapacity) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `${staff.name} has reached daily capacity (${todayApps.length}/${staff.dailyCapacity})`,
      );
    }

    // Check time conflict
    let hasConflict = false;
    for (const existing of todayApps) {
      const exStart = parseISO(existing.dateTime.toISOString());
      const exEnd = addMinutes(exStart, existing.service?.durationMinutes || 30);
      if (timesOverlap(exStart, exEnd, start, end)) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      assignedAppointment = appt;
      break;
    }
  }

  if (!assignedAppointment) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'No non-conflicting time slot found in queue for this staff right now',
    );
  }

  // 3. Assign in transaction
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: assignedAppointment.id },
      data: {
        staffId: staff.id,
        status: 'Scheduled',
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        staffId: staff.id,
        appointmentId: assignedAppointment.id,
        message: `Appointment for "${assignedAppointment.customerName}" manually assigned from queue to ${staff.name}`,
        action: 'QUEUE_TO_STAFF_MANUAL',
      },
    });

    return updated;
  });

  return {
    success: true,
    assigned: {
      id: assignedAppointment.id,
      customerName: assignedAppointment.customerName,
      serviceName: assignedAppointment.service.name,
      staffName: staff.name,
      dateTime: assignedAppointment.dateTime.toISOString(),
    },
  };
};

export const QueueServices = {
  assignFromQueueToStaff,
  getWaitingQueue,
};
