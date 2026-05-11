import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { organizationType } from '../../types';

export let v1OrganizationPresenter = Presenter.create(organizationType)
  .presenter(async ({ organization }, opts) => ({
    object: 'organization',

    id: organization.id,
    type: organization.type,
    slug: organization.slug,
    name: organization.name,
    image_url: await getImageUrl(organization),
    created_at: organization.createdAt,
    updated_at: organization.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The organization's unique identifier`,
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      type: v.enumOf(['default'], {
        name: 'type',
        description: `The organization's type`
      }),
      slug: v.string({
        name: 'slug',
        description: `The organization's slug`,
        examples: ['acme-corp']
      }),
      name: v.string({
        name: 'name',
        description: `The organization's name`,
        examples: ['Acme Corporation']
      }),
      image_url: v.string({
        name: 'image_url',
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
