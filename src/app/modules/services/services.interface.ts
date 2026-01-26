import type { z } from 'zod';

import type { createServicesSchema } from './services.validation';

export type TCreateServicesPayload = z.infer<typeof createServicesSchema>;
