import { Presenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';
import { providerRunType } from '../../types';

export let v1ProviderRunPresenter = Presenter.create(providerRunType)
  .presenter(async ({ providerRun }) => ({
    object: 'session.provider_run' as const,
    id: providerRun.id,

    status: providerRun.status,

    session_id: providerRun.sessionId,
    session_provider_id: providerRun.sessionProviderId,
    provider_id: providerRun.providerId,
    connection_id: providerRun.connectionId,

    completed_at: providerRun.completedAt,
    created_at: providerRun.createdAt,
    updated_at: providerRun.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.provider_run', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique provider run identifier',
        examples: ['prn_8hJkLmNpQrStUvWx']
      }),
      status: v.string({
        name: 'status',
        description: 'Run status',
        examples: ['running', 'stopped']
      }),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      session_provider_id: v.string({
        name: 'session_provider_id',
        description: 'Session provider ID',
        examples: ['spr_3cDeFgHjKlMnPqRs']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      connection_id: v.string({
        name: 'connection_id',
        description: 'Connection ID',
        examples: ['scn_8hJkLmNpQrStUvWx']
      }),
      completed_at: v.nullable(
        v.date({
          name: 'completed_at',
          description: 'Timestamp when run completed',
          examples: [new Date('2025-09-15T10:30:05Z')]
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
