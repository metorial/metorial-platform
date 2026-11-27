import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { deploymentPreviewType } from '../../../types';

export let v1ProviderDeploymentPreviewPresenter = Presenter.create(deploymentPreviewType)
  .presenter(async ({ deployment }) => ({
    object: 'provider.deployment#preview' as const,
    id: deployment.id,

    is_default: deployment.isDefault,

    name: deployment.name,
    description: deployment.description,
    metadata: deployment.metadata,

    provider_id: deployment.provider.id,

    created_at: deployment.createdAt,
    updated_at: deployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.deployment#preview', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pde_1aBcDeFgHjKlMnPq']
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: "Used when a request doesn't name a deployment."
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Display name.', examples: ['Production'] })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Production deployment']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this deployment belongs to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
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
