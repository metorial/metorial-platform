import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { getImageUrl } from '../lib/getImageUrl';
import { organizationType } from '../types';

export let v1OrganizationPresenter = Presenter.create(organizationType)
  .presenter(async ({ organization }, opts) => ({
    id: organization.id,
    status: organization.status,
    type: organization.type,
    slug: organization.slug,
    name: organization.name,
    image_url: getImageUrl(organization),
    created_at: organization.createdAt,
    updated_at: organization.updatedAt
  }))
  .schema(
    v.object({
      id: v.string({ name: 'id', description: `The organization's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The organization's status`
      }),
      type: v.enumOf(['default'], {
        name: 'type',
        description: `The organization's type`
      }),
      slug: v.string({ name: 'slug', description: `The organization's slug` }),
      name: v.string({ name: 'name', description: `The organization's name` }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization's unique identifier`
      }),
      image_url: v.string({
        name: 'imageUrl',
        description: `The organization's image URL`,
        examples: ['https://avatar-cdn.metorial.com/aimg_1234567890']
      }),
      created_at: v.date({
        name: 'created_at',
        description: `The organization's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The organization's last update date`
      })
    })
  )
  .build();
