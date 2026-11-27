import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerSurfaceProviderGroupType } from '../../types';

export let v1ConsumerSurfaceProviderGroupPresenter = Presenter.create(
  consumerSurfaceProviderGroupType
)
  .presenter(async ({ consumerSurfaceProviderGroup }) => ({
    object: 'consumer.surface.provider_group' as const,
    id: consumerSurfaceProviderGroup.id,
    name: consumerSurfaceProviderGroup.name,
    description: consumerSurfaceProviderGroup.description,
    index: consumerSurfaceProviderGroup.index,
    created_at: consumerSurfaceProviderGroup.createdAt,
    updated_at: consumerSurfaceProviderGroup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.surface.provider_group', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      name: v.string({ description: 'Display name.' }),
      description: v.nullable(v.string({ description: 'Free-text description.' })),
      index: v.number({ description: 'Order of the group in the portal catalog.' }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();
