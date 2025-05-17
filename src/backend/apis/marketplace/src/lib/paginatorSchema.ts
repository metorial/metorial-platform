import { z } from 'zod';

export let paginatorSchema = z.object({
  limit: z.optional(z.number().min(1).max(100)),
  after: z.optional(z.string()),
  before: z.optional(z.string()),
  cursor: z.optional(z.string()),
  order: z.optional(z.enum(['asc', 'desc']))
});
