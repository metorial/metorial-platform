import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { networkType } from '../../types';

export let v1NetworkPresenter = Presenter.create(networkType)
  .presenter(async ({ network }) => ({
    object: 'network' as const,
    id: network.id,
    name: network.name,
    description: network.description,
    created_at: network.createdAt,
    updated_at: network.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('network'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
