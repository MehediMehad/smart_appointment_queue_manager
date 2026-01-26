import type { z } from 'zod';

import type { createAppointmentsSchema } from './appointments.validation';

export type TCreateAppointmentsPayload = z.infer<typeof createAppointmentsSchema>;
