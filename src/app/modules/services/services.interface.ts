import type { z } from 'zod';

import type { createServicesSchema, updateServicesSchema } from './services.validation';

export type TCreateServicesPayload = z.infer<typeof createServicesSchema>;
export type TUpdateServicesPayload = z.infer<typeof updateServicesSchema>;
