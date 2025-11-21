import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerProfileType } from '../types';
import { v1ConsumerGroupPresenter } from './consumerGroup';

export let v1ConsumerProfilePresenter = Presenter.create(consumerProfileType)
  .presenter(async ({ consumerProfile, assignedConsumerGroups }, opts) => ({
    object: 'consumer.profile',

    id: consumerProfile.id,

    name: consumerProfile.name,
    email: consumerProfile.email,

    image_url: await getImageUrl({
      ...consumerProfile,
      image: null
    }),

    groups: assignedConsumerGroups
      ? await Promise.all(
          assignedConsumerGroups.map(async g => ({
            object: 'consumer.profile.group_assignment',

            group: await v1ConsumerGroupPresenter.present({ consumerGroup: g }, opts).run(),
            assigned_via: g.assignedVia
          }))
        )
      : null,

    consumer_id: consumerProfile.consumer.id,

    created_at: consumerProfile.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.profile', {
        name: 'object',
        description: 'Type of the object, fixed as consumer.profile'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the consumer profile'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the consumer profile'
      }),

      email: v.string({
        name: 'email',
        description: 'The email address of the consumer profile'
      }),

      image_url: v.string({
        name: 'image_url',
        description: 'The URL of the profile image associated with this consumer profile'
      }),

      groups: v.nullable(
        v.array(
          v.object({
            object: v.literal('consumer.profile.group_assignment', {
              name: 'object',
              description: 'Type of the object, fixed as consumer.profile.group_assignment'
            }),

            group: v1ConsumerGroupPresenter.schema,

            assigned_via: v.enumOf(['default', 'manual', 'sso', 'user'], {
              name: 'assigned_via',
              description:
                'Indicates how the consumer profile was assigned to this group: default, manual, or sso'
            })
          }),
          {
            name: 'groups',
            description:
              'A list of groups that the consumer profile is associated with, along with assignment method'
          }
        )
      ),

      consumer_id: v.string({
        name: 'consumer_id',
        description: 'The unique identifier of the consumer associated with this profile'
      }),

      sso_user_id: v.nullable(
        v.string({
          name: 'sso_user_id',
          description:
            'The unique identifier of the SSO user associated with this profile, or null if not linked'
        })
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the consumer profile was created'
      })
    })
  )
  .build();
