import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverType } from '../types';
import { v1ServerVariantPresenter } from './serverVariant';

export let v1ServerPresenter = Presenter.create(serverType)
  .presenter(async ({ server, currentOrganization }, opts) => ({
    object: 'server',

    id: server.id,
    type: {
      imported: 'public' as const,
      custom:
        server.isPublic &&
        currentOrganization.oid != server.ownerOrganizationOid &&
        opts.accessType != 'user_auth_token'
          ? ('public' as const)
          : ('custom' as const)
    }[server.type],

    status: server.status,

    name: server.importedServer?.name ?? server.name ?? 'Unknown',
    description: server.importedServer?.description ?? server.description,

    variants: await Promise.all(
      server.variants.map(variant =>
        v1ServerVariantPresenter
          .present(
            {
              serverVariant: {
                ...variant,
                server
              }
            },
            opts
          )
          .run()
      )
    ),

    metadata: server.metadata,

    created_at: server.createdAt,
    updated_at: server.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for the server'
      }),

      type: v.enumOf(['public', 'custom'], {
        name: 'type',
        description: 'The visibility type of the server; currently only "public" is supported'
      }),

      status: v.enumOf(['active', 'inactive'], {
        name: 'status',
        description: 'The current status of the server'
      }),

      name: v.string({
        name: 'name',
        description: 'The display name of the server'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'An optional description providing more details about the server'
        })
      ),

      imported_server_id: v.nullable(
        v.string({
          name: 'imported_server_id',
          description: 'ID of the server this one was imported from, if applicable'
        })
      ),

      variants: v.array(v1ServerVariantPresenter.schema, {
        name: 'variants',
        description: 'A list of available variants for this server'
      }),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Arbitrary key-value metadata associated with the server'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server was last updated'
      })
    })
  )
  .build();
