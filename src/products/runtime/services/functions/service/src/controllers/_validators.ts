import { v } from '@lowerdeck/validation';

export let egressAllowListValidator = v.object({
  direction: v.literal('egress'),
  entries: v.array(
    v.object({
      cidr: v.string(),
      portRange: v.optional(
        v.object({
          from: v.number(),
          to: v.number()
        })
      )
    })
  )
});
