import { v } from '@lowerdeck/validation';

export let dateFilterValidator = (timestamp: string) =>
  v.optional(
    v.object(
      {
        gt: v.optional(
          v.date({
            description: 'Exclusive lower bound.'
          })
        ),
        lt: v.optional(
          v.date({
            description: 'Exclusive upper bound.'
          })
        )
      },
      {
        description: `Only return results whose ${timestamp} is in this range. Set \`gt\`, \`lt\`, or both.`
      }
    )
  );
