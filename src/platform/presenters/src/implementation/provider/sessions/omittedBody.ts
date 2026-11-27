import {
  GET_PAYLOAD_LIMIT_BYTES,
  LIST_PAYLOAD_LIMIT_BYTES
} from '@metorial-subspace/connection-utils';

export { presentOmittedBody } from '@metorial-subspace/connection-utils';

export let omittedBodyDescription = `Bodies larger than ${LIST_PAYLOAD_LIMIT_BYTES / 1024} KB in list responses, or larger than ${GET_PAYLOAD_LIMIT_BYTES / 1024 / 1024} MB when retrieving by ID, are replaced with a session.message.omitted_body object.`;
