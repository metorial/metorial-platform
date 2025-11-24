import { z } from 'zod';

export let paginatorSchema = z.object({
  limit: z.optional(
    z.string().refine(
      v => {
        let num = Number(v);
        return !isNaN(num) && num > 0 && num <= 100;
      },
      { message: 'Limit must be a number between 1 and 100' }
    )
  ),
  after: z.optional(z.string()),
  before: z.optional(z.string()),
  order: z.optional(z.enum(['asc', 'desc']))
});
