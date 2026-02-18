import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { subspaceSessionEventType } from '../../types';

export let v1SubspaceSessionEventPresenter = Presenter.create(subspaceSessionEventType)
  .presenter(async ({ sessionEvent }) => ({
    object: 'session.event' as const,
    id: sessionEvent.id,
    type: sessionEvent.type,
    name: sessionEvent.name,
    message: sessionEvent.message,
    data: sessionEvent.data,
    metadata: sessionEvent.metadata,
    session_id: sessionEvent.sessionId,
    session_provider_id: sessionEvent.sessionProviderId,
    provider_run_id: sessionEvent.providerRunId,
    created_at: sessionEvent.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.event', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session event identifier',
        examples: ['sev_8hJkLmNpQrStUvWx']
      }),
      type: v.nullable(
        v.string({
          name: 'type',
          description: 'Event type',
          examples: ['error', 'warning', 'info']
        })
      ),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Event name',
          examples: ['tool_execution_failed']
        })
      ),
      message: v.nullable(
        v.record(v.any(), {
          name: 'message',
          description: 'Event message'
        })
      ),
      data: v.nullable(
        v.record(v.any(), {
          name: 'data',
          description: 'Event data',
          examples: [{ tool_name: 'search_files', error_code: 'TIMEOUT' }]
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ severity: 'high' }]
        })
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      session_provider_id: v.nullable(
        v.string({
          name: 'session_provider_id',
          description: 'Session provider ID',
          examples: ['spr_3cDeFgHjKlMnPqRs']
        })
      ),
      provider_run_id: v.nullable(
        v.string({
          name: 'provider_run_id',
          description: 'Provider run ID',
          examples: ['prn_8hJkLmNpQrStUvWx']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
