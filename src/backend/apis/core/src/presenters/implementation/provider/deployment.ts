import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerDeploymentType } from '../../types';
import { toolFilterPresenter } from '../_lib/toolFilter';
import { v1ProviderConfigPreviewPresenter } from './configPreview';
import { v1ProviderVersionPresenter } from './providerVersion';

export let v1ProviderDeploymentPresenter = Presenter.create(providerDeploymentType)
  .presenter(async ({ deployment }, opts) => ({
    object: 'provider.deployment' as const,

    id: deployment.id,

    is_default: deployment.isDefault,

    name: deployment.name,
    description: deployment.description,
    metadata: deployment.metadata,
    tool_filter: toolFilterPresenter(deployment.toolFilter),

    provider_id: deployment.providerId,

    locked_version: deployment.lockedVersion
      ? await v1ProviderVersionPresenter
          .present({ version: deployment.lockedVersion }, opts)
          .run()
      : null,

    default_config: deployment.defaultConfig
      ? await v1ProviderConfigPreviewPresenter
          .present({ config: deployment.defaultConfig }, opts)
          .run()
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
      is_default: v.boolean({
        name: 'is_default',
        description: 'Whether this is the default deployment'
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
      tool_filter: toolFilterPresenter.schema,
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      locked_version: v.nullable(v1ProviderVersionPresenter.schema),
      default_config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
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
