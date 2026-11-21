import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, presentResourceSource, resourceAccessSchema } from '../../_shared';
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

    access: {
      source: presentResourceSource(config.source),
      type: config.isOwnerLocked ? ('owner_locked' as const) : ('public' as const),
      visibility: config.isOwnerOnlyVisible ? ('owner' as const) : ('anyone' as const),
      owner: presentOwnerActor(config.ownerActor)
    },

    created_at: config.createdAt,
    updated_at: config.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.config', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pcf_7dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Archived once the config is archived. Archived configs stay listable.'
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'The deployment falls back to this config when none is specified.'
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name.',
          examples: ['Production Config']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Configuration for production environment']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ label: 'primary', notes: 'Default production config' }]
        })
      ),
      tool_filter: toolFilterPresenter.schema,
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider this config belongs to.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      specification_id: v.string({
        name: 'specification_id',
        description: 'Specification this config follows.',
        examples: ['psp_9gHjKlMnPqRsTuVw']
      }),
      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),
      from_vault: v.nullable(v1ProviderConfigVaultPresenter.schema),
      access: resourceAccessSchema,
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

export let dashboardConfigPresenter = Presenter.create(providerConfigType)
  .presenter(async ({ config }, opts) => {
    let inner = await v1ConfigPresenter.present({ config }, opts).run({});

    return {
      ...inner,

      public_mcp_server_id: config.ownerPublicMcpServer?.id ?? null
    };
  })
  .schema(
    v.intersection([
      v1ConfigPresenter.schema,
      v.object({
        public_mcp_server_id: v.nullable(
          v.string({
            name: 'public_mcp_server_id',
            description:
              "ID of the public MCP server this resource belongs to. Such resources hold an end user's credentials and are read-only.",
            examples: ['pmsv_1aBcDeFgHjKlMnPq']
          })
        )
      })
    ])
  )
  .build();
