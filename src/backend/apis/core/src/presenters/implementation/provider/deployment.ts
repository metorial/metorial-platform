import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { deploymentType, deploymentPreviewType } from '../../types';
import { v1ProviderPreview } from './providerPreview';
import { v1VersionPresenter } from './version';

let deploymentConfigPreviewSchema = v.object({
  id: v.string({
    name: 'id',
    description: 'Deployment config identifier',
    examples: ['pcf_7dEfGhJkLmNpQrSt']
  }),
  name: v.nullable(
    v.string({ name: 'name', description: 'Display name', examples: ['Default Config'] })
  ),
  description: v.nullable(
    v.string({
      name: 'description',
      description: 'Description',
      examples: ['Default configuration settings']
    })
  ),
  metadata: v.nullable(
    v.record(v.any(), {
      name: 'metadata',
      description: 'Custom key-value pairs for storing additional information',
      examples: [{ notes: 'Primary config' }]
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
});

export let v1DeploymentPreviewPresenter = Presenter.create(deploymentPreviewType)
  .presenter(async ({ deployment }) => ({
    object: 'provider.deployment' as const,
    id: deployment.id,
    name: deployment.name,
    provider_id: deployment.providerId
  }))
  .schema(
    v.object({
      object: v.literal('provider.deployment', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Deployment ID',
        examples: ['pde_1aBcDeFgHjKlMnPq']
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Deployment name', examples: ['Production'] })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      })
    })
  )
  .build();

export let v1DeploymentPresenter = Presenter.create(deploymentType)
  .presenter(async ({ deployment }, opts) => ({
    object: 'provider.deployment' as const,
    id: deployment.id,
    name: deployment.name,
    description: deployment.description,
    metadata: deployment.metadata,
    provider_id: deployment.providerId,
    provider: deployment.provider ? v1ProviderPreview(deployment.provider) : null,
    locked_version: deployment.lockedVersion
      ? await v1VersionPresenter.present({ version: deployment.lockedVersion }, opts).run()
      : null,
    default_config: deployment.defaultConfig
      ? {
          id: deployment.defaultConfig.id,
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
      object: v.literal('provider.deployment', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique deployment identifier',
        examples: ['pde_1aBcDeFgHjKlMnPq']
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Display name', examples: ['Production'] })
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
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ notes: 'Main deployment' }]
        })
      ),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      provider: v.nullable(v1ProviderPreview.schema),
      locked_version: v.nullable(v1VersionPresenter.schema),
      default_config: v.nullable(deploymentConfigPreviewSchema),
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
