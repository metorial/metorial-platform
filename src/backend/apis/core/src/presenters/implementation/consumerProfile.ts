import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { consumerProfileType } from '../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';
import { v1ConsumerSurfacePresenter } from './consumerSurface';

export let v1ConsumerProfilePresenter = Presenter.create(consumerProfileType)
  .presenter(async ({ consumerProfile, assignedConsumerGroups }, opts) => ({
    object: 'consumer.profile' as const,
    id: consumerProfile.id,
    name: consumerProfile.name,
    email: consumerProfile.email,
    image_url: await getImageUrl({
      id: consumerProfile.id,
      name: consumerProfile.name,
      email: consumerProfile.email,
      image: null
    }),
    groups: assignedConsumerGroups
      ? await Promise.all(
          assignedConsumerGroups.map(async group => ({
            object: 'consumer.profile.group_assignment' as const,
            group: await v1ConsumerGroupPresenter
              .present({ consumerGroup: group }, opts)
              .run(),
            assigned_via: group.assignedVia
          }))
        )
      : null,
    consumer_id: consumerProfile.consumer.id,
    status:
      consumerProfile.inviteStatus == 'invited' ? ('invited' as const) : ('active' as const),
    created_at: consumerProfile.createdAt,
    updated_at: consumerProfile.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.profile'),
      id: v.string(),
      name: v.string(),
      email: v.string(),
      image_url: v.string(),
      groups: v.nullable(
        v.array(
          v.object({
            object: v.literal('consumer.profile.group_assignment'),
            group: v1ConsumerGroupPresenter.schema,
            assigned_via: v.enumOf(['default', 'manual', 'sso', 'user'])
          })
        )
      ),
      consumer_id: v.string(),
      status: v.enumOf(['active', 'invited']),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let dashboardConsumerProfilePresenter = Presenter.create(consumerProfileType)
  .presenter(async ({ consumerProfile, assignedConsumerGroups }, opts) => {
    let inner = await v1ConsumerProfilePresenter
      .present({ consumerProfile, assignedConsumerGroups }, opts)
      .run();

    return {
      ...inner,
      surface: await v1ConsumerSurfacePresenter
        .present({ consumerSurface: consumerProfile.surface }, opts)
        .run()
    };
  })
  .schema(
    v.intersection([
      v1ConsumerProfilePresenter.schema,
      v.object({
        surface: v1ConsumerSurfacePresenter.schema
      })
    ])
  )
  .build();
