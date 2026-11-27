import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderType } from '../../../types';
import { v1ScmRepoPresenter } from '../../scm';
import { v1ProviderPresenter } from '../provider';
import { v1BucketPresenter } from './bucket';

export let v1CustomProviderPresenter = Presenter.create(customProviderType)
  .presenter(async ({ customProvider, tenant }, opts) => ({
    object: 'custom_provider' as const,

    id: customProvider.id,
    status: customProvider.status,

    type: customProvider.payload.from?.type!,

    name: customProvider.name,
    description: customProvider.description,
    metadata: customProvider.metadata,

    scm_repo: customProvider.scmRepo
      ? await v1ScmRepoPresenter.present({ scmRepo: customProvider.scmRepo }, opts).run()
      : null,

    provider: customProvider.provider
      ? await v1ProviderPresenter
          .present({ provider: customProvider.provider, tenant }, opts)
          .run()
      : null,

    draft: {
      object: `custom_provider.draft#${customProvider.payload.from?.type}`,

      container_image:
        customProvider.containerTag &&
        customProvider.containerRegistry &&
        customProvider.containerRepository
          ? {
              object: `custom_provider.draft.container_image`,
              container_registry: customProvider.containerRegistry.url!,
              container_image_tag: customProvider.containerTag.name!,
              container_image: customProvider.containerRepository.name!
            }
          : undefined,

      remote_mcp_server:
        customProvider.remoteProtocol && customProvider.remoteUrl
          ? {
              object: `custom_provider.draft.remote_mcp_server`,
              url: customProvider.remoteUrl,
              transport: customProvider.remoteProtocol
            }
          : undefined,

      config: {
        object: `custom_provider.draft.config`,
        schema: {
          type: 'json_schema' as const,
          schema: customProvider.payload.config?.schema!
        },
        transformer: customProvider.payload.config?.transformer!
      }
    } as any,

    created_at: customProvider.createdAt,
    updated_at: customProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: '`archived` once archived. Archived providers reject new connections.'
      }),
      type: v.enumOf(['function', 'container', 'remote'], {
        name: 'type',
        description: 'How the provider runs: `function`, `container`, or `remote`.'
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['My Custom Provider']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['A custom provider for my application']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ environment: 'production' }]
        })
      ),
      draft: v.object(
        {
          object: v.enumOf(
            [
              'custom_provider.draft#function',
              'custom_provider.draft.container',
              'custom_provider.draft.remote'
            ],
            {
              description: 'String representing the object’s type.'
            }
          ),

          container_image: v.optional(
            v.object(
              {
                object: v.literal('custom_provider.draft.container', {
                  description: 'String representing the object’s type.'
                }),

                container_registry: v.string({
                  name: 'container_registry',
                  description: 'Registry the image is pulled from.',
                  examples: ['https://index.docker.io/v1/']
                }),
                container_image_tag: v.string({
                  name: 'container_image_tag',
                  description: 'Tag selecting the image version.',
                  examples: ['v1.0.0']
                }),
                container_image: v.string({
                  name: 'container_image',
                  description: 'Name of the image in the registry.',
                  examples: ['my-app-image']
                })
              },
              {
                description:
                  'Container image this provider deploys. Only set for `container` providers.'
              }
            )
          ),

          remote_mcp_server: v.optional(
            v.object(
              {
                object: v.literal('custom_provider.draft.remote', {
                  description: 'String representing the object’s type.'
                }),

                url: v.string({
                  name: 'url',
                  description: 'URL where the remote MCP server is reachable.',
                  examples: ['https://mcp.example.com']
                }),
                transport: v.enumOf(['sse', 'streamable_http', 'stateless'], {
                  name: 'transport',
                  description: 'MCP transport the remote server speaks.'
                })
              },
              {
                description:
                  'Remote MCP server this provider connects to. Only set for `remote` providers.'
              }
            )
          ),

          config: v.object(
            {
              object: v.literal('custom_provider.draft.config', {
                description: 'String representing the object’s type.'
              }),
              schema: v.object(
                {
                  type: v.literal('json_schema', {
                    description: 'Format of the configuration schema.'
                  }),
                  schema: v.record(v.any(), {
                    name: 'schema',
                    description: "JSON Schema for the provider's configuration."
                  })
                },
                { description: 'Configuration fields for the custom provider.' }
              ),
              transformer: v.string({
                name: 'transformer',
                description: "Code that transforms the provider's configuration."
              })
            },
            { description: 'Configuration for the custom provider.' }
          )
        },
        { description: 'Draft source and configuration of the custom provider.' }
      ),

      scm_repo: v.nullable(v1ScmRepoPresenter.schema, {
        description: 'Repository the provider code is deployed from. `null` when not linked.'
      }),
      provider: v.nullable(v1ProviderPresenter.schema, {
        description:
          'Session provider backed by this custom provider. `null` when none is linked.'
      }),
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

export let dashboardCustomProviderPresenter = Presenter.create(customProviderType)
  .presenter(async ({ customProvider, tenant }, opts) => {
    let inner = await v1CustomProviderPresenter
      .present({ customProvider, tenant }, opts)
      .run();

    return {
      ...inner,
      draft_bucket: customProvider.draftCodeBucket
        ? await v1BucketPresenter
            .present({ bucket: customProvider.draftCodeBucket }, opts)
            .run()
        : null
    };
  })
  .schema(
    v.intersection([
      v1CustomProviderPresenter.schema,
      v.object({
        draft_bucket: v.nullable(v1BucketPresenter.schema, {
          description:
            'Bucket holding the draft code. `null` for providers without draft code.'
        })
      })
    ])
  )
  .build();
