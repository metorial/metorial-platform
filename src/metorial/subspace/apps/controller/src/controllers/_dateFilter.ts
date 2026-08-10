import { v } from '@lowerdeck/validation';

export let createdAtValidator = v.optional(
  v.object({
    gt: v.optional(v.date()),
    lt: v.optional(v.date())
  })
);

export let updatedAtValidator = v.optional(
  v.object({
    gt: v.optional(v.date()),
    lt: v.optional(v.date())
  })
);
