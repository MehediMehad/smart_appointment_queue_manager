import type { z } from 'zod';

import type { createStaffsSchema } from './staffs.validation';

export type TCreateStaffsPayload = z.infer<typeof createStaffsSchema>;
