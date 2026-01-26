import type { z } from 'zod';

import type { createQueueSchema } from './queue.validation';

export type TCreateQueuePayload = z.infer<typeof createQueueSchema>;
