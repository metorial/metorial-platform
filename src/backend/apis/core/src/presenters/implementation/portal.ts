import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { portalType } from '../types';

export let v1PortalPresenter = Presenter.create(portalType)
  .presenter(async ({ portal, portalUrl }, opts) => ({
    object: 'portal',

    id: portal.id,

    status: {
      active: 'active',
      inactive: 'inactive'
    }[portal.status],

    name: portal.name,
    slug: portal.slug,
    description: portal.description,

    urls: [
      {
        type: 'default',
        url: portalUrl
      }
    ],

    brand: {
      image: await getImageUrl({
        ...portal,
        image: portal.brandImage
      }),

      name: portal.brandName
    },

    created_at: portal.createdAt,
    updated_at: portal.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('portal', {
        name: 'object',
        description: 'Type of the object, fixed as portal'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the portal'
      }),

      status: v.enumOf(['active', 'inactive'], {
        name: 'status',
        description: 'The status of the portal'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the portal'
      }),

      slug: v.string({
        name: 'slug',
        description: 'The slug of the portal'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'The description of the portal'
        })
      ),

      urls: v.array(
        v.object({
          type: v.enumOf(['default'], {
            name: 'urls.type',
            description: 'The type of the portal URL'
          }),
          url: v.string({
            name: 'urls.url',
            description: 'The portal URL'
          })
        }),
        {
          name: 'urls',
          description: 'List of URLs associated with the portal'
        }
      ),

      brand: v.object(
        {
          image: v.string({
            name: 'brand.image',
            description: 'The brand image URL of the portal'
          }),
          name: v.string({
            name: 'brand.name',
            description: 'The brand name of the portal'
          })
        },
        {
          name: 'brand',
          description: 'The brand information of the portal'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the portal was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the portal was last updated'
      })
    })
  )
  .build();
