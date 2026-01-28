import { z } from 'zod';

export const createAppointmentsSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email('Invalid email format').optional(),
  serviceId: z.string().min(1, 'Service is required'),
  dateTime: z.string().min(1, 'Date and time is required'),
});

export const updateAppointmentsSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').optional(),
  serviceId: z.string().min(1, 'Service is required').optional(),
  dateTime: z.string().min(1, 'Date and time is required').optional(),
  staffId: z.string().optional(),
  status: z.enum(['Scheduled', 'Waiting', 'Completed', 'Cancelled', 'NoShow']).optional(),
});


export const AppointmentsValidations = {
  createAppointmentsSchema,
  updateAppointmentsSchema,
};
