import { createError } from '@lowerdeck/error';

export let invalidPayloadError = createError({
  status: 400,
  code: 'invalid_payload',
  message: 'The request payload is not valid for this ingest route.'
});

export let invalidClientError = createError({
  status: 400,
  code: 'invalid_client',
  message: 'The client in the route is not a valid client identifier.',
  hint: 'Use lowercase letters, digits, dots, dashes and underscores.'
});

export let invalidBatchHeaderError = createError({
  status: 400,
  code: 'invalid_batch_header',
  message: 'The first line of a bulk request must be a valid batch header.'
});
