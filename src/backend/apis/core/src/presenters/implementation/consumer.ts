import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerType } from '../types';

export let v1ConsumerPresenter = Presenter.create(consumerType)
  .presenter(async ({ consumer }) => ({
    object: 'consumer' as const,
    id: consumer.id,
    name: consumer.name,
    email: consumer.email,
    created_at: consumer.createdAt,
    updated_at: consumer.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer'),
      id: v.string(),
      name: v.string(),
      email: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
