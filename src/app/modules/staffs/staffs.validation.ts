import { StaffStatusEnum } from '@prisma/client';
import { z } from 'zod';

export const createStaffsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  serviceType: z.string().min(2, 'Service type must be at least 2 characters'),
  dailyCapacity: z.number().min(1, 'Daily capacity must be at least 1'),
  status: z.nativeEnum(StaffStatusEnum).default(StaffStatusEnum.Available),
});

export const updateStaffsSchema = z.object({
  status: z.nativeEnum(StaffStatusEnum),
});

export const StaffsValidations = {
  createStaffsSchema,
  updateStaffsSchema,
};
