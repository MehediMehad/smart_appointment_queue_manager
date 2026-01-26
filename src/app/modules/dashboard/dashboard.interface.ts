import type { z } from 'zod';

import type { createDashboardSchema } from './dashboard.validation';

export type TCreateDashboardPayload = z.infer<typeof createDashboardSchema>;
