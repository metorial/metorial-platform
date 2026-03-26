import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sessionEventType } from '../../types';
import { v1ProviderRunPresenter } from './providerRun';
import { v1SessionConnectionPresenter } from './sessionConnection';
import { v1SessionErrorPresenter } from './sessionError';
import { v1SubspaceSessionMessagePresenter } from './sessionMessage';
import { v1SessionWarningPresenter } from './sessionWarning';

export let v1SubspaceSessionEventPresenter = Presenter.create(sessionEventType)
  .presenter(async ({ sessionEvent }, opts) => ({
    object: 'session.event' as const,

    id: sessionEvent.id,
    type: sessionEvent.type,

    connection: sessionEvent.connection
      ? await v1SessionConnectionPresenter
          .present({ sessionConnection: sessionEvent.connection }, opts)
          .run()
      : null,

    provider_run: sessionEvent.providerRun
      ? await v1ProviderRunPresenter
          .present({ providerRun: sessionEvent.providerRun }, opts)
          .run()
      : null,

    message: sessionEvent.message
      ? await v1SubspaceSessionMessagePresenter
          .present({ sessionMessage: sessionEvent.message }, opts)
          .run()
      : null,

    error: sessionEvent.error
      ? await v1SessionErrorPresenter.present({ sessionError: sessionEvent.error }, opts).run()
      : null,

    warning: sessionEvent.warning
      ? await v1SessionWarningPresenter
          .present({ sessionWarning: sessionEvent.warning }, opts)
          .run()
      : null,

    session_id: sessionEvent.sessionId,

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
      type: v.enumOf(
        [
          'session_created',
          'session_started',
          'provider_run_started',
          'provider_run_stopped',
          'message_created',
          'message_processed',
          'connection_created',
          'connection_connected',
          'connection_disconnected',
          'connection_disabled',
          'error_occurred',
          'warning_occurred'
        ] as const,
        {
          name: 'type',
          description: 'Event type'
        }
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      connection: v.nullable(v1SessionConnectionPresenter.schema),
      provider_run: v.nullable(v1ProviderRunPresenter.schema),
      message: v.nullable(v1SubspaceSessionMessagePresenter.schema),
      error: v.nullable(v1SessionErrorPresenter.schema),
      warning: v.nullable(v1SessionWarningPresenter.schema),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
