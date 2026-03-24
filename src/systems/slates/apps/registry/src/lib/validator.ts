import { zValidator } from '@hono/zod-validator';
import { validationError } from '@lowerdeck/error';
import type { ValidationTargets } from 'hono';
import type z from 'zod';

export let useValidation = <Target extends keyof ValidationTargets, T extends z.ZodType<any>>(
  target: Target,
  schema: T
) =>
  zValidator(target, schema, (data, c) => {
    if (!data.success)
      return c.json(
        validationError({
          entity: 'query',
          errors: data.error.issues.map(e => ({
            code: e.code,
            message: e.message,
            path: e.path.map(p => p.toString())
          }))
        }).toResponse(),
        400
      ) as never;
  });
