import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { configVaultType } from '../types';

export let v1ConfigVaultPresenter = Presenter.create(configVaultType)
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
      object: v.literal('provider.config_vault'),
      id: v.string({ name: 'id', description: 'Unique config vault identifier', examples: ['vault_abc123def456'] }),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['Production Secrets'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Secure storage for production credentials'] })),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom metadata', examples: [{ env: 'production' }] })),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pvd_abc123def456'] }),
      provider_deployment_id: v.nullable(
        v.string({ name: 'provider_deployment_id', description: 'Deployment ID', examples: ['dep_abc123def456'] })
      ),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
