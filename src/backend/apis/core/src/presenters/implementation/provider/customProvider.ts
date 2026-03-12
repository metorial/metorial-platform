import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { customProviderType } from '../../types';
import { v1ScmRepoPresenter } from '../scm/repos';
import { v1BucketPresenter } from './bucket';
import { v1ProviderPresenter } from './provider';

export let v1CustomProviderPresenter = Presenter.create(customProviderType)
  .presenter(async ({ customProvider }, opts) => ({
    object: 'custom_provider' as const,

    id: customProvider.id,
    status: customProvider.status,

    name: customProvider.name,
    description: customProvider.description,
    metadata: customProvider.metadata,

    scm_repo: customProvider.scmRepo
      ? await v1ScmRepoPresenter.present({ scmRepo: customProvider.scmRepo }, opts).run()
      : null,

    provider: customProvider.provider
      ? await v1ProviderPresenter.present({ provider: customProvider.provider }, opts).run()
      : null,

    draft: {
      container_image:
        customProvider.draft.containerTag &&
        customProvider.draft.containerRegistry &&
        customProvider.draft.containerRepository
          ? {
              container_registry: customProvider.draft.containerRegistry.url!,
              container_image_tag: customProvider.draft.containerTag.name!,
              container_image: customProvider.draft.containerRepository.name!
            }
          : undefined,

      remote_mcp_server:
        customProvider.draft.remoteProtocol && customProvider.draft.remoteUrl
          ? {
              url: customProvider.draft.remoteUrl,
              transport: customProvider.draft.remoteProtocol
            }
          : undefined
    } as any,

    created_at: customProvider.createdAt,
    updated_at: customProvider.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('custom_provider', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique custom provider identifier',
        examples: ['cpr_1aBcDeFgHjKlMnPq']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Current status of the custom provider'
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the custom provider',
        examples: ['My Custom Provider']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Brief description of the custom provider',
          examples: ['A custom provider for my application']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ environment: 'production' }]
        })
      ),
      draft: v.object({
        container_image: v.optional(
          v.object({
            container_registry: v.string({
              name: 'container_registry',
              description: 'URL of the container registry',
              examples: ['https://index.docker.io/v1/']
            }),
            container_image_tag: v.string({
              name: 'container_image_tag',
              description: 'Tag of the container image',
              examples: ['v1.0.0']
            }),
            container_image: v.string({
              name: 'container_image',
              description: 'Name of the container image',
              examples: ['my-app-image']
            })
          })
        ),

        remote_mcp_server: v.optional(
          v.object({
            url: v.string({
              name: 'url',
              description: 'URL of the remote MCP server',
              examples: ['https://mcp.example.com']
            }),
            transport: v.enumOf(['sse', 'streamable_http'], {
              name: 'transport',
              description: 'Transport protocol for connecting to the remote MCP server'
            })
          })
        )
      }),

      scm_repo: v.nullable(v1ScmRepoPresenter.schema),
      provider: v.nullable(v1ProviderPresenter.schema),
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

export let dashboardCustomProviderPresenter = Presenter.create(customProviderType)
  .presenter(async ({ customProvider }, opts) => {
    let inner = await v1CustomProviderPresenter.present({ customProvider }, opts).run();

    return {
      ...inner,
      draft_bucket: customProvider.draftBucket
        ? await v1BucketPresenter.present({ bucket: customProvider.draftBucket }, opts).run()
        : null
    };
  })
  .schema(
    v.intersection([
      v1CustomProviderPresenter.schema,
      v.object({
        draft_bucket: v.nullable(v1BucketPresenter.schema)
      })
    ])
  )
  .build();
