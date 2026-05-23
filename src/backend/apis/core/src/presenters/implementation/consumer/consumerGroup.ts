import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { consumerGroupType } from '../../types';

export let v1ConsumerGroupPresenter = Presenter.create(consumerGroupType)
  .presenter(async ({ consumerGroup }) => ({
    object: 'consumer.group' as const,
    id: consumerGroup.id,
    status: consumerGroup.status,
    name: consumerGroup.name,
    description: consumerGroup.description,
    is_default: consumerGroup.isDefault,
    sso_group_ids: consumerGroup.ssoGroupIds,
    created_at: consumerGroup.createdAt,
    updated_at: consumerGroup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.group'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      is_default: v.boolean(),
      sso_group_ids: v.array(v.string()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
