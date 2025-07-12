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

      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      slug: v.string(),

      image_url: v.string(),

      is_official: v.boolean(),
      is_metorial: v.boolean(),
      is_verified: v.boolean(),

      badges: v.array(
        v.object({
          type: v.enumOf(['system', 'staff']),
          name: v.string()
        })
      ),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
