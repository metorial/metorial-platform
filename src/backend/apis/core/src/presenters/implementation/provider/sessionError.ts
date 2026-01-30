import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionErrorType } from '../../types';

export let v1SessionErrorPresenter = Presenter.create(sessionErrorType)
  .presenter(async ({ sessionError }) => ({
    object: 'session.error' as const,
    id: sessionError.id,
    type: sessionError.type,
    name: sessionError.name,
    message: sessionError.message,
    stack: sessionError.stack,
    metadata: sessionError.metadata,
    session_id: sessionError.sessionId,
    session_error_group_id: sessionError.sessionErrorGroupId,
    provider_run_id: sessionError.providerRunId,
    created_at: sessionError.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.error', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique session error identifier', examples: ['ser_6fGhJkLmNpQrStUv'] }),
      type: v.nullable(v.string({ name: 'type', description: 'Error type', examples: ['RuntimeError'] })),
      name: v.nullable(v.string({ name: 'name', description: 'Error name', examples: ['ConnectionTimeout'] })),
      message: v.nullable(v.string({ name: 'message', description: 'Error message', examples: ['Connection timed out after 30 seconds'] })),
      stack: v.nullable(v.string({ name: 'stack', description: 'Error stack trace', examples: ['Error: Connection timed out\n    at Socket.connect...'] })),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom key-value pairs', examples: [{ timeout_ms: 30000 }] })),
      session_id: v.string({ name: 'session_id', description: 'Parent session ID', examples: ['ses_4dEfGhJkLmNpQrSt'] }),
      session_error_group_id: v.nullable(v.string({ name: 'session_error_group_id', description: 'Error group ID', examples: ['seg_7gHjKlMnPqRsTuVw'] })),
      provider_run_id: v.nullable(v.string({ name: 'provider_run_id', description: 'Provider run ID', examples: ['prn_8hJkLmNpQrStUvWx'] })),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] })
    })
  )
  .build();
