import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverType } from '../types';
import { v1ServerVariantPresenter } from './serverVariant';

export let v1ServerPresenter = Presenter.create(serverType)
  .presenter(async ({ server }, opts) => ({
    object: 'server',

    id: server.id,
    type: { imported: 'public' as const }[server.type],

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

      id: v.string(),
      type: v.enumOf(['public']),

      name: v.string(),
      description: v.nullable(v.string()),
      imported_server_id: v.nullable(v.string()),

      variants: v.array(v1ServerVariantPresenter.schema),

      metadata: v.record(v.any()),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
