import { z } from 'zod';

export const createAppointmentsSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email('Invalid email format').optional(),
  serviceId: z.string().min(1, 'Service is required'),
  dateTime: z.string().min(1, 'Date and time is required'),
});

export const updateAppointmentsSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  serviceId: z.string().min(1, 'Service is required'),
  dateTime: z.string().min(1, 'Date and time is required'),
  staffId: z.string().optional(),
  status: z.enum(['Scheduled', 'Waiting', 'Completed', 'Cancelled', 'NoShow']).optional(),
});

// UPDATE BODY DATA
// customerName ?: string;
// serviceId ?: string;
// dateTime ?: string;       // ISO string "2026-01-26T11:30:00.000Z"
// staffId ?: string | null; // allow explicit null to move to queue
// status ?: 'Scheduled' | 'Waiting' | 'Completed' | 'Cancelled' | 'NoShow';

export const AppointmentsValidations = {
  createAppointmentsSchema,
  updateAppointmentsSchema,
};
