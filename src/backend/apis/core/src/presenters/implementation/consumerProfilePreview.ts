import { ConsumerProfile, getImageUrl } from '@metorial/db';
import { v } from '@metorial/validation';

export let v1ConsumerProfilePreview = Object.assign(
  async (consumerProfile: ConsumerProfile) => ({
    object: 'consumer.profile',

    id: consumerProfile.id,

    name: consumerProfile.name,
    email: consumerProfile.email,

    image_url: await getImageUrl({
      ...consumerProfile,
      image: null
    }),

    created_at: consumerProfile.createdAt
  }),
  {
    schema: v.object({
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

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the consumer profile was created'
      })
    })
  }
);
