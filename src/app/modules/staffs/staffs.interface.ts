import type { z } from 'zod';

import type { createStaffsSchema, updateStaffsSchema } from './staffs.validation';

export type TCreateStaffsPayload = z.infer<typeof createStaffsSchema>;

export type TUpdateStaffsPayload = z.infer<typeof updateStaffsSchema>;
