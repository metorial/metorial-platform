import { badRequestError, ServiceError, validationError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import z from 'zod';

let Sentry = getSentry();

export let validateJsonSchema = ({
  schema,
  data,
  entity,
  message,
  strict = false
}: {
  schema: any;
  data: unknown;
  entity: string;
  message?: string;
  strict?: boolean;
}) => {
  let valRes: z.ZodSafeParseResult<unknown>;

  try {
    valRes = z.fromJSONSchema(schema).safeParse(data);
  } catch (e) {
    console.error(e);

    Sentry.captureException(e, {
      extra: { schema, entity }
    });

    if (strict)
      throw new ServiceError(badRequestError({ message: `Could not validate ${entity}.` }));
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

// True only when the schema compiles and rejects the data; compile errors are left to validateJsonSchema.
export let jsonSchemaRejects = ({ schema, data }: { schema: any; data: unknown }) => {
  try {
    return !z.fromJSONSchema(schema).safeParse(data).success;
  } catch {
    return false;
  }
};
