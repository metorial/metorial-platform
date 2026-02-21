import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionErrorType } from '../../types';

export let v1SessionErrorPresenter = Presenter.create(sessionErrorType)
  .presenter(async ({ sessionError }) => ({
    object: 'session.error' as const,

    id: sessionError.id,

    code: sessionError.code,
    message: sessionError.message,
    data: sessionError.data,

    session_id: sessionError.sessionId,
    provider_run_id: sessionError.providerRunId,
    connection_id: sessionError.connectionId,

    group_id: sessionError.groupId,
    similar_error_count: sessionError.similarErrorCount,

    created_at: sessionError.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.error', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session error identifier',
        examples: ['ser_6fGhJkLmNpQrStUv']
      }),
      code: v.string({
        name: 'code',
        description: 'Error code',
        examples: ['CONNECTION_TIMEOUT']
      }),
      message: v.string({
        name: 'message',
        description: 'Error message',
        examples: ['Connection timed out after 30 seconds']
      }),
      data: v.record(v.any(), {
        name: 'data',
        description: 'Error payload data',
        examples: [{ timeout_ms: 30000 }]
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      provider_run_id: v.nullable(
        v.string({
          name: 'provider_run_id',
          description: 'Provider run ID',
          examples: ['prn_8hJkLmNpQrStUvWx']
        })
      ),
      connection_id: v.nullable(
        v.string({
          name: 'connection_id',
          description: 'Connection ID',
          examples: ['scn_8hJkLmNpQrStUvWx']
        })
      ),
      group_id: v.string({
        name: 'group_id',
        description: 'Error group ID',
        examples: ['seg_7gHjKlMnPqRsTuVw']
      }),
      similar_error_count: v.number({
        name: 'similar_error_count',
        description: 'Count of similar errors in the group',
        examples: [5]
      }),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
