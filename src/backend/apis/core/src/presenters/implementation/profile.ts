import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { profileType } from '../types';

export let v1ProfilePresenter = Presenter.create(profileType)
  .presenter(async ({ profile }, opts) => ({
    object: 'profile',

    id: profile.id,
    name: profile.name,
    description: profile.description,
    slug: profile.slug,

    image_url: await getImageUrl(profile),

    is_official: profile.type == 'system',
    is_metorial: profile.type == 'system',
    is_verified: profile.type == 'system',

    badges:
      profile.type == 'system'
        ? [
            {
              type: 'system',
              name: 'Metorial'
            },
            {
              type: 'staff',
              name: 'Metorial Staff'
            }
          ]
        : [],

    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('profile'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the profile'
      }),

      name: v.string({
        name: 'name',
        description: 'The display name of the profile'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'An optional short bio or summary of the profile'
        })
      ),

      slug: v.string({
        name: 'slug',
        description: 'A URL-safe identifier used to reference the profile in links',
        examples: ['openai', 'acme-inc']
      }),

      image_url: v.string({
        name: 'image_url',
        description: 'URL pointing to the profile’s avatar or representative image',
        examples: ['https://cdn.metorial.com/images/profiles/12345/avatar.png']
      }),

      is_official: v.boolean({
        name: 'is_official',
        description: 'Indicates whether this is an officially maintained profile'
      }),

      is_metorial: v.boolean({
        name: 'is_metorial',
        description: 'True if this profile is managed directly by Metorial'
      }),

      is_verified: v.boolean({
        name: 'is_verified',
        description: 'Indicates whether the profile has been verified for authenticity'
      }),

      badges: v.array(
        v.object({
          type: v.enumOf(['system', 'staff'], {
            name: 'type',
            description: 'The category of badge awarded to the profile'
          }),
          name: v.string({
            name: 'name',
            description: 'The display name of the badge',
            examples: ['Top Contributor', 'Team Member']
          })
        }),
        {
          name: 'badges',
          description: 'A list of badges associated with the profile, if any'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'The timestamp when the profile was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The timestamp when the profile was last updated'
      })
    })
  )
  .build();
