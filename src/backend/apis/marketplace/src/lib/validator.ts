import { zValidator } from '@hono/zod-validator/dist';
import { validationError } from '@metorial/error';
import { ValidationTargets } from 'hono';
import { ZodSchema } from 'zod';

export let useValidation = <Target extends keyof ValidationTargets, T extends ZodSchema>(
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
      );
  });
