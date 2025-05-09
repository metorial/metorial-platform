import { Cases } from '@metorial/case';
import { ValidationError } from '@metorial/validation';
import { ErrorData, createError } from './error';

export let validationError = (
  d: { errors: ValidationError[]; entity: string } & Partial<ErrorData<'invalid_data', 400>>
) =>
  createError({
    status: 400,
    code: 'invalid_data',
    message: 'The provided data is invalid.',
    hint: 'Make sure the data you are sending follows the specification outlined in the documentation.',
    ...d
  });

export let internalServerError = createError({
  status: 500,
  code: 'internal_server_error',
  message: 'An internal server error occurred.'
});

export let badRequestError = createError({
  status: 400,
  code: 'bad_request',
  message: 'The request is invalid.'
});

export let notFoundError = (
  // d: string | ({ entity: string } & Partial<ErrorData<'not_found', 404>>)

  ...[p1, p2]:
    | [{ entity: string; id?: string } & Partial<ErrorData<'not_found', 404>>]
    | [string, string | undefined | null]
    | [string]
) => {
  let entity = typeof p1 == 'string' ? p1 : p1.entity;
  let id = typeof p1 == 'string' ? p2 : p1.id;

  return createError({
    status: 404,
    code: 'not_found',
    message: `The requested ${Cases.toKebabCase(entity)} could not be found.`,
    hint: 'Make sure the resource you are trying to access exists, that you have access to it and that it has not been deleted.',
    entity,
    id: id ?? undefined,

    ...(typeof p1 == 'string' ? {} : p1)
  });
};

export let unauthorizedError = createError({
  status: 401,
  code: 'unauthorized',
  message: 'You are not authorized to access this resource.',
  hint: 'Make sure you are logged in and have the correct permissions to access this resource.'
});

export let forbiddenError = createError({
  status: 403,
  code: 'forbidden',
  message: 'You do not have permission to access this resource.'
});

export let invalidVersion = createError({
  status: 400,
  code: 'invalid_version',
  message: 'The endpoint does not support the requested version.'
});

export let conflictError = createError({
  status: 409,
  code: 'conflict',
  message: 'A similar resource already exists.'
});

export let goneError = createError({
  status: 410,
  code: 'gone',
  message: 'The requested resource is no longer available.'
});

export let paymentRequiredError = createError({
  status: 402,
  code: 'payment_required',
  message: 'Payment is required to access this resource.'
});

export let preconditionFailedError = createError({
  status: 412,
  code: 'precondition_failed',
  message: 'The precondition of the request failed.'
});

export let notAcceptableError = createError({
  status: 406,
  code: 'not_acceptable',
  message: 'The requested resource is not acceptable.'
});

export let notImplementedError = createError({
  status: 501,
  code: 'not_implemented',
  message: 'The requested resource is not implemented.'
});

export let tooManyRequestsError = createError({
  status: 429,
  code: 'too_many_requests',
  message: 'You have made too many requests in a short period of time.',
  hint: 'Please wait a moment and try again.'
});
