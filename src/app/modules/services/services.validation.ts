import { z } from "zod";

export const createServicesSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  durationMinutes: z.number().min(1, 'Duration must be at least 1'),
  requiredStaffType: z.string().min(2, 'Required staff type must be at least 2 characters'),
});

export const ServicesValidations = {
  createServicesSchema,
};