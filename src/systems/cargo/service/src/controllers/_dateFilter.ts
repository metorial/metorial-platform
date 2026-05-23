import { v } from '@mtsrc/validation';

export let dateFilterSchema = v.optional(
  v.object({
    gt: v.optional(v.date()),
    lt: v.optional(v.date())
  })
);
