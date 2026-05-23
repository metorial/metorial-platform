import { ServiceError, validationError } from '@mtsrc/error';
import { getSentry } from '@mtsrc/sentry';
import z from 'zod';

let Sentry = getSentry();

export let validateJsonSchema = ({
  schema,
  data,
  entity,
  message
}: {
  schema: any;
  data: unknown;
  entity: string;
  message?: string;
}) => {
  let valRes: z.ZodSafeParseResult<unknown>;

  try {
    valRes = z.fromJSONSchema(schema).safeParse(data);
  } catch (e) {
    console.error(e);
    Sentry.captureException(e, {
      extra: { schema, data }
    });

    return data;
  }

  if (!valRes.success) {
    throw new ServiceError(
      validationError({
        errors: valRes.error.issues.map(e => ({
          ...e,
          path: e.path.map(String)
        })),
        entity,
        message
      })
    );
  }

  return valRes.data as any;
};
