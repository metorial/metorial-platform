import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverInstanceType } from '../types';

export let v1ServerInstancePresenter = Presenter.create(serverInstanceType)
  .presenter(async ({ serverInstance }, opts) => ({
    id: serverInstance.id,
    status: serverInstance.status,

    name: serverInstance.name,
    description: serverInstance.description,

    metadata: serverInstance.metadata,
    get_launch_params: serverInstance.getLaunchParams,

    server_id: serverInstance.server.id,
    server_variant_id: serverInstance.serverVariant.id,

    created_at: serverInstance.createdAt,
    updated_at: serverInstance.updatedAt
  }))
  .schema(
    v.object({
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),

      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),

      get_launch_params: v.nullable(v.string()),

      server_id: v.string(),
      server_variant_id: v.string(),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
