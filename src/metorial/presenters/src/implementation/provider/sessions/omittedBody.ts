import {
  GET_PAYLOAD_LIMIT_BYTES,
  LIST_PAYLOAD_LIMIT_BYTES
} from '@metorial-subspace/connection-utils';

export let presentOmittedBody = (size: number | null) => ({
  object: 'session.message.omitted_body' as const,
  reason: 'body_too_large' as const,
  size
});

export let omittedBodyDescription = `Bodies larger than ${LIST_PAYLOAD_LIMIT_BYTES / 1024} KB in list responses, or larger than ${GET_PAYLOAD_LIMIT_BYTES / 1024 / 1024} MB when retrieving by ID, are replaced with a session.message.omitted_body object.`;
