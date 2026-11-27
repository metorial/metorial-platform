import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerRunType } from '../../../types';

export let v1ProviderRunPresenter = Presenter.create(providerRunType)
  .presenter(async ({ providerRun }) => ({
    object: 'session.provider_run' as const,
    id: providerRun.id,

    status: providerRun.status,

    session_id: providerRun.session.id,
    session_provider_id: providerRun.sessionProvider.id,
    provider_id: providerRun.provider.id,
    connection_id: providerRun.connection.id,

    completed_at: providerRun.completedAt,
    created_at: providerRun.createdAt,
    updated_at: providerRun.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.provider_run', {
        description: "String representing the object’s type."
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['prn_8hJkLmNpQrStUvWx']
      }),
      status: v.enumOf(['running', 'stopped'], {
        name: 'status',
        description: '`running` while the provider handles messages. `stopped` once it finishes.'
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'Session the run belongs to.',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      session_provider_id: v.string({
        name: 'session_provider_id',
        description: 'Session provider that handled the run.',
        examples: ['spr_3cDeFgHjKlMnPqRs']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider that ran.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      connection_id: v.string({
        name: 'connection_id',
        description: 'Connection the run used.',
        examples: ['scn_8hJkLmNpQrStUvWx']
      }),
      completed_at: v.nullable(
        v.date({
          name: 'completed_at',
          description: 'When the run finished. `null` while it is still running.',
          examples: [new Date('2025-09-15T10:30:05Z')]
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
