import { createError } from '@lowerdeck/error';

export let missingCredentialError = createError({
  status: 401,
  code: 'missing_credential',
  message: 'No ingest token was provided.',
  hint: 'Send the token as "Authorization: Bearer <token>" or in the "x-api-key" header.'
});

export let invalidCredentialError = createError({
  status: 401,
  code: 'invalid_credential',
  message: 'The ingest token is invalid, expired or revoked.'
});
