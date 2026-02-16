import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { configVaultType } from '../../types';

export let v1ProviderConfigVaultPresenter = Presenter.create(configVaultType)
  .presenter(async ({ configVault }) => ({
    object: 'provider.config_vault' as const,
    id: configVault.id,
    name: configVault.name,
    description: configVault.description,
    metadata: configVault.metadata,
    provider_id: configVault.providerId,
    provider_deployment_id: configVault.providerDeploymentId ?? configVault.deploymentId,
    created_at: configVault.createdAt,
    updated_at: configVault.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.config_vault', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique config vault identifier',
        examples: ['pcvt_3bCdEfGhJkLmNpQr']
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name',
          examples: ['Production Secrets']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['Secure storage for production credentials']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ owner: 'platform-team', sensitivity: 'high' }]
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Deployment ID',
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
