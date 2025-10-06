import { badRequestError, ServiceError, validationError } from '@metorial/error';
import { ValidationType } from '@metorial/validation';
import { Context } from 'hono';

export let useValidatedBody = async <T>(c: Context, v: ValidationType<T>): Promise<T> => {
  let body: any;

  if (c.req.header('Content-Type')?.includes('application/x-www-form-urlencoded')) {
    body = Object.fromEntries(new URLSearchParams(await c.req.text()));
  } else {
    try {
      body = await c.req.json();
    } catch (e) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid JSON body'
        })
      );
    }
  }

  let val = v.validate(body);
  if (!val.success) {
    throw new ServiceError(
      validationError({
        entity: 'body',
        errors: val.errors
      })
    );
  }

  return val.value;
};

export let useValidatedQuery = async <T>(c: Context, v: ValidationType<T>): Promise<T> => {
  let body: any;

  try {
    body = c.req.query();
  } catch (e) {
    throw new ServiceError(
      badRequestError({
        message: 'Invalid JSON body'
      })
    );
  }

  let val = v.validate(body);
  if (!val.success) {
    throw new ServiceError(
      validationError({
        entity: 'query',
        errors: val.errors
      })
    );
  }

  return val.value;
};
