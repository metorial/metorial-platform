import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { configType, configPreviewType } from '../types';

export let v1ConfigPreviewPresenter = Presenter.create(configPreviewType)
  .presenter(async ({ config }) => ({
    object: 'provider.config.preview' as const,
    id: config.id,
    name: config.name,
    provider_deployment_id: config.providerDeploymentId ?? config.deploymentId
  }))
  .schema(
    v.object({
      object: v.literal('provider.config.preview'),
      id: v.string({ name: 'id', description: 'Config ID', examples: ['cfg_abc123def456'] }),
      name: v.nullable(v.string({ name: 'name', description: 'Config name', examples: ['Production Config'] })),
      provider_deployment_id: v.nullable(
        v.string({ name: 'provider_deployment_id', description: 'Deployment ID', examples: ['dep_abc123def456'] })
      )
    })
  )
  .build();

export let v1ConfigPresenter = Presenter.create(configType)
  .presenter(async ({ config }) => ({
    object: 'provider.config' as const,
    id: config.id,
    is_ephemeral: config.isEphemeral ?? false,
    is_default: config.isDefault ?? false,
    name: config.name,
    description: config.description,
    metadata: config.metadata,
    provider_id: config.providerId,
    provider_deployment_id: config.providerDeploymentId ?? config.deploymentId,
    created_at: config.createdAt,
    updated_at: config.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.config'),
      id: v.string({ name: 'id', description: 'Unique config identifier', examples: ['cfg_abc123def456'] }),
      is_ephemeral: v.boolean({ name: 'is_ephemeral', description: 'Whether ephemeral', examples: [false] }),
      is_default: v.boolean({ name: 'is_default', description: 'Whether default', examples: [true] }),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['Production Config'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Configuration for production environment'] })),
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
