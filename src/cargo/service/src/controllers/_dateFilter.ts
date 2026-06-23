import { v } from '@lowerdeck/validation';

export let dateFilterSchema = v.optional(
  v.object({
    gt: v.optional(v.date()),
    lt: v.optional(v.date())
  })
);
