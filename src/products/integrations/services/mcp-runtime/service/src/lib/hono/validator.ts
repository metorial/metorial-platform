import { zValidator } from '@hono/zod-validator';
import { validationError } from '@lowerdeck/error';

export let useValidation = ((target: any, schema: any) =>
  zValidator(target, schema, (data, c) => {
    if (!data.success)
      return c.json(
        validationError({
          entity: target,
          errors: data.error.issues.map(e => ({
            code: e.code,
            message: e.message,
            path: e.path.map(p => p.toString())
          }))
        }).toResponse(),
        400
      );
  })) as typeof zValidator;
