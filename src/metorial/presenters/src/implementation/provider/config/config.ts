import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerConfigType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderConfigVaultPresenter } from './configVault';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

export let v1ConfigPresenter = Presenter.create(providerConfigType)
  .presenter(async ({ config }, opts) => ({
    object: 'provider.config' as const,

    id: config.id,
    status: config.status,

    is_default: config.isDefault,

    name: config.name,
    description: config.description,
    metadata: config.metadata,
    tool_filter: toolFilterPresenter(config.toolFilter),

    provider_id: config.provider.id,
    specification_id: config.specification.id,

    deployment: config.deployment
      ? await v1ProviderDeploymentPreviewPresenter
          .present(
            {
              deployment: {
                ...config.deployment,
                provider: config.provider
              }
            },
            opts
          )
          .run()
      : null,

    from_vault: config.fromVault
      ? await v1ProviderConfigVaultPresenter
          .present(
            {
              configVault: {
                ...config.fromVault,
                provider: config.provider
              }
            },
            opts
          )
          .run()
      : null,

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
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Config status'
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'Whether this is the default config'
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
      tool_filter: toolFilterPresenter.schema,
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      specification_id: v.string({
        name: 'specification_id',
        description: 'Specification ID',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),
      from_vault: v.nullable(v1ProviderConfigVaultPresenter.schema),
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
