import { error, t } from '@lowerdeck/rpc-spec';

export let MAX_PAYLOAD_BYTES = 6 * 1024 * 1024;

export let InvokeInput = t
  .object({
    versionId: t.string({ minLength: 1 }),
    payloadJson: t
      .string({ maxLength: MAX_PAYLOAD_BYTES })
      .description('The payload as JSON text. The invocation token signs the SHA-256 of these UTF-8 bytes.'),
    invocationToken: t.string({ minLength: 1 }),
    egressGrant: t.string({ minLength: 1 }),
    deadlineMs: t.int({ min: 1, max: 960_000 })
  })
  .named('InvokeInput');

export let InvokeLogLine = t
  .object({
    ts: t.datetime(),
    stream: t.enum(['stdout', 'stderr']),
    line: t.string()
  })
  .named('InvokeLogLine');

export let InvokeOutput = t
  .object({
    payload: t.json().description('The `{ statusCode, body }` envelope.'),
    logs: t.array(InvokeLogLine),
    logsTruncated: t.boolean(),
    computeTimeMs: t.int({ min: 0 }),
    bootError: t.boolean()
  })
  .named('InvokeOutput');

export let invocationUnauthorized = error({
  status: 401,
  code: 'invocation_unauthorized',
  message: 'The invocation token or egress grant was rejected.',
  data: { reason: t.string() }
});

export let functionUnavailable = error({
  status: 503,
  code: 'function_unavailable',
  message: 'No ready instance answered before the invocation deadline.'
});
