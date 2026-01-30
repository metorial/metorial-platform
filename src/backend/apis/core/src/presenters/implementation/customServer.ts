import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { customServerType } from '../types';
import { v1ServerPreview } from './serverPreview';
import { v1ServerVariantPreview } from './serverVariantPreview';

export let v1CustomServerPresenter = Presenter.create(customServerType)
  .presenter(async ({ customServer }, opts) => ({
    object: 'custom_server',

    id: customServer.id,

    status: {
      active: 'active',
      archived: 'archived',
      deleted: 'deleted'
    }[customServer.status],

    type: {
      remote: 'remote',
      managed: 'managed',
      docker: 'docker'
    }[customServer.type],

    publication_status: customServer.isPublic ? 'public' : 'private',

    name: customServer.name ?? customServer.server.name,
    description: customServer.description ?? customServer.server.description,

    current_version_id: customServer.currentVersion?.id ?? null,

    metadata: customServer.server.metadata ?? {},

    created_at: customServer.createdAt,
    updated_at: customServer.updatedAt,
    deleted_at: customServer.deletedAt,

    server: v1ServerPreview(customServer.server),

    server_variant: v1ServerVariantPreview(customServer.serverVariant, customServer.server)
  }))
  .schema(
    v.object({
      object: v.literal('custom_server', { description: "String representing the object's type" }),

      id: v.string({ name: 'id', description: 'The unique identifier for the custom server' }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The current status of the custom server'
      }),

      type: v.enumOf(['remote', 'managed'], {
        name: 'type',
        description: 'The type of the custom server'
      }),

      publication_status: v.enumOf(['public', 'private'], {
        name: 'publication_status',
        description: 'The publication status of the custom server'
      }),

      name: v.string({ name: 'name', description: 'The name of the custom server' }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'An optional description of the custom server'
        })
      ),

      current_version_id: v.nullable(
        v.string({
          name: 'current_version_id',
          description: `The ID of the current server version, if available`
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Metadata associated with the custom server'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the custom server was created',
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the custom server was last updated',
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      deleted_at: v.nullable(
        v.date({
          name: 'deleted_at',
          description: 'Timestamp when the custom server was deleted, if applicable',
          examples: [new Date('2024-01-15T09:30:00Z')]
        })
      ),

      server: v1ServerPreview.schema,

      server_variant: v1ServerVariantPreview.schema
    })
  )
  .build();

export let dashboardCustomServerPresenter = Presenter.create(customServerType)
  .presenter(async ({ customServer }, opts) => {
    let base = await v1CustomServerPresenter.present({ customServer }, opts).run();

    return {
      ...base,

      repository: customServer.repository
        ? {
            object: 'scm.repo',
            id: customServer.repository.id,
            name: customServer.repository.externalName,
            owner: customServer.repository.externalOwner,
            url: customServer.repository.externalUrl,
            default_branch: customServer.repository.defaultBranch,
            created_at: customServer.repository.createdAt,
            updated_at: customServer.repository.updatedAt
          }
        : null,

      fork:
        customServer.isForkable && customServer.forkTemplateManagedServer
          ? {
              status: 'enabled' as const,
              template_id: customServer.forkTemplateManagedServer.id
            }
          : {
              status: 'disabled' as const
            }
    };
  })
  .schema(
    v.intersection([
      v1CustomServerPresenter.schema,

      v.object({
        fork: v.union([
          v.object({
            status: v.literal('disabled', {
              name: 'enabled',
              description: 'Indicates if forking is enabled for this custom server'
            })
          }),
          v.object({
            status: v.literal('enabled', {
              name: 'enabled',
              description: 'Indicates if forking is enabled for this custom server'
            }),
            template_id: v.string({
              name: 'template_id',
              description:
                'The unique identifier of the managed server template used for forking'
            })
          })
        ]),

        repository: v.nullable(
          v.object({
            object: v.literal('scm.repo', { description: "String representing the object's type" }),

            id: v.string({
              name: 'id',
              description: `The unique identifier of the SCM repository`
            }),

            name: v.string({
              name: 'name',
              description: `The name of the SCM repository`
            }),
            owner: v.string({
              name: 'owner',
              description: `The owner of the SCM repository`
            }),
            url: v.string({
              name: 'url',
              description: `The external URL of the SCM repository`
            }),
            default_branch: v.string({
              name: 'default_branch',
              description: `The default branch of the SCM repository`
            }),

            created_at: v.date({
              name: 'created_at',
              description: `The timestamp when the SCM repository was created`
            }),
            updated_at: v.date({
              name: 'updated_at',
              description: `The timestamp when the SCM repository was last updated`
            })
          })
        )
      })
    ])
  )
  .build();
