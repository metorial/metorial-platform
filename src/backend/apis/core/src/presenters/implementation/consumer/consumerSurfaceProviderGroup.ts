import { v } from '@mtsrc/validation';
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
      object: v.literal('consumer.surface.provider_group'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      index: v.number(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
