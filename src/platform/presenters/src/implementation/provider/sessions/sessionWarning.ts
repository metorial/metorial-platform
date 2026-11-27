import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionWarningType } from '../../../types';

export let v1SessionWarningPresenter = Presenter.create(sessionWarningType)
  .presenter(async ({ sessionWarning }) => ({
    object: 'session.warning' as const,

    id: sessionWarning.id,

    code: sessionWarning.code,
    message: sessionWarning.message,
    // The former RPC returned null here despite the non-null API schema.
    data: sessionWarning.payload as Record<string, any>,

    session_id: sessionWarning.session.id,
    connection_id: sessionWarning.connection?.id ?? null,

    created_at: sessionWarning.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('session.warning', {
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['ser_6fGhJkLmNpQrStUv']
      }),
      code: v.string({
        name: 'code',
        description: 'Machine-readable warning code.',
        examples: ['CONNECTION_TIMEOUT']
      }),
      message: v.string({
        name: 'message',
        description: 'Human-readable warning message.',
        examples: ['Connection timed out after 30 seconds']
      }),
      data: v.record(v.any(), {
        name: 'data',
        description: 'Additional warning details.',
        examples: [{ timeout_ms: 30000 }]
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'Session the warning occurred in.',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      connection_id: v.nullable(
        v.string({
          name: 'connection_id',
          description: 'Connection the warning belongs to. `null` when there is none.',
          examples: ['scn_8hJkLmNpQrStUvWx']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
