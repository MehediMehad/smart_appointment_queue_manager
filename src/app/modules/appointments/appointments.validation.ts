import { z } from 'zod';

export const createAppointmentsSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email('Invalid email format').optional(),
  serviceId: z.string().min(1, 'Service is required'),
  dateTime: z.string().min(1, 'Date and time is required'),
});

export const AppointmentsValidations = {
  createAppointmentsSchema,
};
