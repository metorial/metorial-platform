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

export let clientNotAllowedError = createError({
  status: 403,
  code: 'client_not_allowed',
  message: 'This ingest token is not allowed to send data for this client.'
});

export let channelNotAllowedError = createError({
  status: 403,
  code: 'channel_not_allowed',
  message: 'This ingest token is not allowed to send data on this channel.'
});
