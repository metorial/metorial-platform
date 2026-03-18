import { Presenter } from '@metorial/presenter';
import { v } from '@lowerdeck/validation';
import { consumerSessionType } from '../types';

export let v1ConsumerSessionPresenter = Presenter.create(consumerSessionType)
  .presenter(async ({ consumerSession }) => ({
    object: 'consumer.session' as const,
    id: consumerSession.id,
    created_at: consumerSession.createdAt,
    expires_at: consumerSession.expiresAt,
    last_used_at: consumerSession.lastUsedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.session'),
      id: v.string(),
      created_at: v.date(),
      expires_at: v.date(),
      last_used_at: v.date()
    })
  )
  .build();
