import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { sessionProviderType } from '../../types';

export let v1SessionProviderPresenter = Presenter.create(sessionProviderType)
  .presenter(async ({ sessionProvider }) => ({
    object: 'session.provider' as const,
    id: sessionProvider.id,
    name: sessionProvider.name,
    description: sessionProvider.description,
    status: sessionProvider.status,
    metadata: sessionProvider.metadata,
    session_id: sessionProvider.sessionId,
    provider_id: sessionProvider.providerId,
    provider_deployment_id: sessionProvider.providerDeploymentId,
    created_at: sessionProvider.createdAt,
    updated_at: sessionProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session.provider', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique session provider identifier',
        examples: ['spr_3cDeFgHjKlMnPqRs']
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Display name', examples: ['GitHub Provider'] })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['Active GitHub provider instance']
        })
      ),
      status: v.nullable(
        v.string({ name: 'status', description: 'Provider status', examples: ['active'] })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ version: '1.0' }]
        })
      ),
      session_id: v.string({
        name: 'session_id',
        description: 'Parent session ID',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Provider deployment ID',
          examples: ['pde_1aBcDeFgHjKlMnPq']
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
