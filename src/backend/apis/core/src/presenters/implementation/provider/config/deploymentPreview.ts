import { v } from '@mtsrc/validation';
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

    provider_id: deployment.providerId,

    created_at: deployment.createdAt,
    updated_at: deployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.deployment#preview', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Deployment ID',
        examples: ['pde_1aBcDeFgHjKlMnPq']
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'Whether this is the default deployment'
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Deployment name', examples: ['Production'] })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['Production deployment']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information'
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
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
