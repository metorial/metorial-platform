import { createError } from '@lowerdeck/error';

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
