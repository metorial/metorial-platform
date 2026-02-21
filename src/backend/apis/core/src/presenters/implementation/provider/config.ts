import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { configPreviewType, providerConfigType } from '../../types';

export let v1ProviderConfigPreviewPresenter = Presenter.create(configPreviewType)
  .presenter(async ({ config }) => ({
    object: 'provider.config' as const,
    id: config.id,
    name: config.name,
    provider_deployment_id: config.providerDeploymentId ?? config.deploymentId
  }))
  .schema(
    v.object({
      object: v.literal('provider.config', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Config ID',
        examples: ['pcf_7dEfGhJkLmNpQrSt']
      }),
      name: v.nullable(
        v.string({ name: 'name', description: 'Config name', examples: ['Production Config'] })
      ),
      provider_deployment_id: v.nullable(
        v.string({
          name: 'provider_deployment_id',
          description: 'Deployment ID',
          examples: ['pde_1aBcDeFgHjKlMnPq']
        })
      )
    })
  )
  .build();

export let v1ConfigPresenter = Presenter.create(providerConfigType)
  .presenter(async ({ config }) => ({
    object: 'provider.config' as const,
    id: config.id,
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
      object: v.literal('provider.config', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique config identifier',
        examples: ['pcf_7dEfGhJkLmNpQrSt']
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name',
          examples: ['Production Config']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['Configuration for production environment']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ label: 'primary', notes: 'Default production config' }]
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
