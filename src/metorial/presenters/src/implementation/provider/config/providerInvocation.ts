import { v } from '@lowerdeck/validation';
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
  .presenter(async ({ providerInvocation }) => {
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
      auth_config_event_ids: providerInvocation.authConfigEventIds,
      provider_oauth_setup_ids: providerInvocation.providerOAuthSetupIds,

      tool_call_id: providerInvocation.toolCallId,
      action: providerInvocation.action,

      requests: providerInvocation.requests,
      responses: providerInvocation.responses,
      request_traces: providerInvocation.requestTraces,
      logs: providerInvocation.logs.map(log => ({
        object: 'provider.invocation.log' as const,
        timestamp: log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp),
        message: log.message,
        output_type: log.outputType ?? null
      })),
      attachments: providerInvocation.attachments,

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
      type: v.enumOf(['tool_call', 'auth_config_event', 'oauth_setup', 'unknown'], {
        name: 'type',
        description: 'Invocation category'
      }),
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
        description: 'Captured outbound request payloads'
      }),
      responses: v.array(v.any(), {
        name: 'responses',
        description: 'Captured response payloads'
      }),
      request_traces: v.array(v.any(), {
        name: 'request_traces',
        description: 'Request trace data'
      }),
      logs: v.array(invocationLogSchema, {
        name: 'logs',
        description: 'Invocation logs'
      }),
      attachments: v.array(v.any(), {
        name: 'attachments',
        description: 'Captured attachments'
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
        v1ProviderInvocationPresenter.present({ providerInvocation }, opts).run()
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
