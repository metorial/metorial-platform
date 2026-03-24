import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackDestinationType } from '../../types';

export let v1CallbackDestinationPresenter = Presenter.create(callbackDestinationType)
  .presenter(async ({ callbackDestination }) => ({
    object: 'callback.destination' as const,
    id: callbackDestination.id,
    status: callbackDestination.status,
    name: callbackDestination.name,
    description: callbackDestination.description,
    metadata: callbackDestination.metadata,
    url: callbackDestination.url,
    method: callbackDestination.method,
    created_at: callbackDestination.createdAt,
    updated_at: callbackDestination.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('callback.destination'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      url: v.string(),
      method: v.string(),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
