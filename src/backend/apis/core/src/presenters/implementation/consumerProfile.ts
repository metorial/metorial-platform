import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { consumerProfileType } from '../types';

export let v1ConsumerProfilePresenter = Presenter.create(consumerProfileType)
  .presenter(async ({ consumerProfile }, opts) => ({
    object: 'consumer.profile',

    id: consumerProfile.id,

    name: consumerProfile.name,
    email: consumerProfile.email,

    image_url: await getImageUrl({
      ...consumerProfile,
      image: null
    }),

    consumer_id: consumerProfile.consumer.id,
    sso_user_id: consumerProfile.ssoUser?.id || null,

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
