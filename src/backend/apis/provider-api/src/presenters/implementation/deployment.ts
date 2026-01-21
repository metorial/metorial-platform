import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { deploymentType, deploymentPreviewType } from '../types';
import { v1VersionPresenter } from './version';

let deploymentConfigPreviewSchema = v.object({
  object: v.literal('provider.deployment_config'),
  id: v.string({ name: 'id', description: 'Deployment config identifier', examples: ['cfg_abc123def456'] }),
  is_ephemeral: v.boolean({ name: 'is_ephemeral', description: 'Whether ephemeral', examples: [false] }),
  is_default: v.boolean({ name: 'is_default', description: 'Whether default', examples: [true] }),
  name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['Production Config'] })),
  description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Configuration for production environment'] })),
  metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom metadata', examples: [{ env: 'production' }] })),
  provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pvd_abc123def456'] }),
  created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
  updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
});

export let v1DeploymentPreviewPresenter = Presenter.create(deploymentPreviewType)
  .presenter(async ({ deployment }) => ({
    object: 'provider.deployment.preview' as const,
    id: deployment.id,
    name: deployment.name,
    is_default: deployment.isDefault ?? false,
    provider_id: deployment.providerId
  }))
  .schema(
    v.object({
      object: v.literal('provider.deployment.preview'),
      id: v.string({ name: 'id', description: 'Deployment ID', examples: ['dep_abc123def456'] }),
      name: v.nullable(v.string({ name: 'name', description: 'Deployment name', examples: ['Production'] })),
      is_default: v.boolean({ name: 'is_default', description: 'Whether default deployment', examples: [true] }),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pvd_abc123def456'] })
    })
  )
  .build();

export let v1DeploymentPresenter = Presenter.create(deploymentType)
  .presenter(async ({ deployment }, opts) => ({
    object: 'provider.deployment' as const,
    id: deployment.id,
    is_ephemeral: deployment.isEphemeral ?? false,
    is_default: deployment.isDefault ?? false,
    name: deployment.name,
    description: deployment.description,
    metadata: deployment.metadata,
    provider_id: deployment.providerId,
    locked_version: deployment.lockedVersion
      ? await v1VersionPresenter.present({ version: deployment.lockedVersion }, opts).run()
      : null,
    default_config: deployment.defaultConfig
      ? {
          object: 'provider.deployment_config' as const,
          id: deployment.defaultConfig.id,
          is_ephemeral: deployment.defaultConfig.isEphemeral ?? false,
          is_default: deployment.defaultConfig.isDefault ?? false,
          name: deployment.defaultConfig.name,
          description: deployment.defaultConfig.description,
          metadata: deployment.defaultConfig.metadata,
          provider_id: deployment.defaultConfig.providerId,
          created_at: deployment.defaultConfig.createdAt,
          updated_at: deployment.defaultConfig.updatedAt
        }
      : null,
    created_at: deployment.createdAt,
    updated_at: deployment.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.deployment'),
      id: v.string({ name: 'id', description: 'Unique deployment identifier', examples: ['dep_abc123def456'] }),
      is_ephemeral: v.boolean({ name: 'is_ephemeral', description: 'Whether ephemeral', examples: [false] }),
      is_default: v.boolean({ name: 'is_default', description: 'Whether default deployment', examples: [true] }),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['Production'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['Production deployment for GitHub MCP'] })),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom metadata', examples: [{ env: 'production', region: 'us-east-1' }] })),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pvd_abc123def456'] }),
      locked_version: v.nullable(v1VersionPresenter.schema),
      default_config: v.nullable(deploymentConfigPreviewSchema),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2024-01-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2024-06-20T14:45:00Z')] })
    })
  )
  .build();
