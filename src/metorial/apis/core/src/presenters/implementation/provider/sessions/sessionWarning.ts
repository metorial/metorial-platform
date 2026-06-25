import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionWarningType } from '../../../types';

export let v1SessionWarningPresenter = Presenter.create(sessionWarningType)
  .presenter(async ({ sessionWarning }) => ({
    object: 'session.warning' as const,

    id: sessionWarning.id,

    code: sessionWarning.code,
    message: sessionWarning.message,
    data: sessionWarning.data,

    session_id: sessionWarning.sessionId,
    connection_id: sessionWarning.connectionId,

    created_at: sessionWarning.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.warning', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session warning identifier',
        examples: ['ser_6fGhJkLmNpQrStUv']
      }),
      code: v.string({
        name: 'code',
        description: 'Warning code',
        examples: ['CONNECTION_TIMEOUT']
      }),
      message: v.string({
        name: 'message',
        description: 'Warning message',
        examples: ['Connection timed out after 30 seconds']
      }),
      data: v.record(v.any(), {
        name: 'data',
        description: 'Warning payload data',
        examples: [{ timeout_ms: 30000 }]
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      connection_id: v.nullable(
        v.string({
          name: 'connection_id',
          description: 'Connection ID',
          examples: ['scn_8hJkLmNpQrStUvWx']
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
