import { v } from '@lowerdeck/validation';
import {
  GET_PAYLOAD_LIMIT_BYTES,
  getJsonSizeBytes,
  LIST_PAYLOAD_LIMIT_BYTES
} from '@metorial-subspace/connection-utils';
import { Presenter } from '@metorial/presenter';
import { providerInvocationType, providerInvocationsType } from '../../../types';

let invocationLogSchema = v.object({
  object: v.literal('provider.invocation.log'),
  timestamp: v.date({
    name: 'timestamp',
    description: 'Log timestamp'
  }),
  message: v.string({
    name: 'message',
    description: 'Log message content'
  }),
  output_type: v.nullable(
    v.string({
      name: 'output_type',
      description: 'Output type when provided by the backing provider'
    })
  )
});

let limitPayloadEntries = (entries: any[], limitBytes: number) =>
  entries.map(entry => {
    let size = getJsonSizeBytes(entry);
    if (size <= limitBytes) return entry;

    return {
      object: 'provider.invocation.omitted_payload',
      reason: 'payload_too_large',
      size
    };
  });

let limitLogMessage = (message: string, limitBytes: number) => {
  let size = Buffer.byteLength(message);
  if (size <= limitBytes) return message;

  return `${Buffer.from(message).subarray(0, limitBytes).toString('utf-8')}… [truncated ${size - limitBytes} bytes]`;
};

let normalizePublicInvocationStatus = (d: {
  status: 'succeeded' | 'failed' | 'processing' | 'unknown';
  error: {
    code: string;
    message: string;
  } | null;
}) => {
  if (d.status === 'failed' || d.error) return 'error' as const;
  return 'success' as const;
};

export let v1ProviderInvocationPresenter = Presenter.create(providerInvocationType)
  .presenter(async ({ providerInvocation, payloadLimitBytes = GET_PAYLOAD_LIMIT_BYTES }) => {
    let status = normalizePublicInvocationStatus({
      status: providerInvocation.status,
      error: providerInvocation.error
    });

    return {
      object: 'provider.invocation' as const,

      id: providerInvocation.id,
      source: providerInvocation.source,
      type: providerInvocation.type,
      status,

      provider_run_ids: providerInvocation.providerRunIds,
      session_message_ids: providerInvocation.sessionMessageIds,
      callback_event_ids: providerInvocation.callbackEventIds,
      auth_config_event_ids: providerInvocation.authConfigEventIds,
      provider_oauth_setup_ids: providerInvocation.providerOAuthSetupIds,

      tool_call_id: providerInvocation.toolCallId,
      action: providerInvocation.action,

      requests: limitPayloadEntries(providerInvocation.requests, payloadLimitBytes),
      responses: limitPayloadEntries(providerInvocation.responses, payloadLimitBytes),
      request_traces: limitPayloadEntries(providerInvocation.requestTraces, payloadLimitBytes),
      logs: providerInvocation.logs.map(log => ({
        object: 'provider.invocation.log' as const,
        timestamp: log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp),
        message: limitLogMessage(log.message, payloadLimitBytes),
        output_type: log.outputType ?? null
      })),
      attachments: limitPayloadEntries(providerInvocation.attachments, payloadLimitBytes),

      error: providerInvocation.error,

      created_at: providerInvocation.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.invocation'),
      id: v.string({
        name: 'id',
        description: 'Unique provider invocation identifier',
        examples: ['piv_8hJkLmNpQrStUvWx']
      }),
      source: v.enumOf(['slates', 'shuttle', 'native'], {
        name: 'source',
        description: 'Backing provider integration source'
      }),
      type: v.enumOf(
        ['tool_call', 'auth_config_event', 'oauth_setup', 'callback_event', 'unknown'],
        {
          name: 'type',
          description: 'Invocation category'
        }
      ),
      status: v.enumOf(['success', 'error'], {
        name: 'status',
        description: 'Normalized invocation outcome status'
      }),
      provider_run_ids: v.array(
        v.string({
          name: 'provider_run_id',
          description: 'Related provider run ID'
        })
      ),
      session_message_ids: v.array(
        v.string({
          name: 'session_message_id',
          description: 'Related session message ID'
        })
      ),
      callback_event_ids: v.array(
        v.string({
          name: 'callback_event_id',
          description: 'Related callback event ID'
        })
      ),
      auth_config_event_ids: v.array(
        v.string({
          name: 'auth_config_event_id',
          description: 'Related auth config event ID'
        })
      ),
      provider_oauth_setup_ids: v.array(
        v.string({
          name: 'provider_oauth_setup_id',
          description: 'Related provider OAuth setup ID'
        })
      ),
      tool_call_id: v.nullable(
        v.string({
          name: 'tool_call_id',
          description: 'Associated tool call ID when available'
        })
      ),
      action: v.nullable(
        v.object({
          id: v.string(),
          key: v.string(),
          name: v.string()
        })
      ),
      requests: v.array(v.any(), {
        name: 'requests',
        description:
          'Captured outbound request payloads. Entries that are too large for this response are replaced with a provider.invocation.omitted_payload object.'
      }),
      responses: v.array(v.any(), {
        name: 'responses',
        description:
          'Captured response payloads. Entries that are too large for this response are replaced with a provider.invocation.omitted_payload object.'
      }),
      request_traces: v.array(v.any(), {
        name: 'request_traces',
        description:
          'Request trace data. Entries that are too large for this response are replaced with a provider.invocation.omitted_payload object.'
      }),
      logs: v.array(invocationLogSchema, {
        name: 'logs',
        description: 'Invocation logs'
      }),
      attachments: v.array(v.any(), {
        name: 'attachments',
        description:
          'Captured attachments. Entries that are too large for this response are replaced with a provider.invocation.omitted_payload object.'
      }),
      error: v.nullable(
        v.object({
          code: v.string(),
          message: v.string()
        })
      ),
      provider: v.nullable(
        v.record(v.any(), {
          name: 'provider',
          description: 'Provider-specific metadata'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Additional normalized metadata'
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created'
      })
    })
  )
  .build();

export let v1ProviderInvocationsPresenter = Presenter.create(providerInvocationsType)
  .presenter(async ({ items }, opts) => ({
    object: 'provider.invocations' as const,
    items: await Promise.all(
      items.map(providerInvocation =>
        v1ProviderInvocationPresenter
          .present({ providerInvocation, payloadLimitBytes: LIST_PAYLOAD_LIMIT_BYTES }, opts)
          .run()
      )
    )
  }))
  .schema(
    v.object({
      object: v.literal('provider.invocations'),
      items: v.array(v1ProviderInvocationPresenter.schema)
    })
  )
  .build();
