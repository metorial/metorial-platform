import { v } from '@lowerdeck/validation';

export let dateFilterValidator = (description: string) =>
  v.optional(
    v.object(
      {
        gt: v.optional(
          v.date({
            description: `Only include records after this timestamp for ${description}`
          })
        ),
        lt: v.optional(
          v.date({
            description: `Only include records before this timestamp for ${description}`
          })
        )
      },
      {
        description: `Filter ${description} by date range`
      }
    )
  );
