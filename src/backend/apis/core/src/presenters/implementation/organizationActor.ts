import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { organizationActorType } from '../types';

export let v1OrganizationActorPresenter = Presenter.create(organizationActorType)
  .presenter(async ({ organizationActor }, opts) => ({
    object: 'organization.actor',

    id: organizationActor.id,
    type: organizationActor.type,

    organization_id: organizationActor.organization.id,

    name: organizationActor.name,
    email: organizationActor.email,
    image_url: await getImageUrl(organizationActor),

    created_at: organizationActor.createdAt,
    updated_at: organizationActor.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.actor'),

      id: v.string({ name: 'id', description: `The organization member's unique identifier` }),
      type: v.enumOf(['member', 'machine_access'], {
        name: 'type',
        description: `The organization member's type`
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization member's organization ID`
      }),
      name: v.string({
        name: 'name',
        description: `The organization member's name`
      }),
      email: v.nullable(
        v.string({
          name: 'email',
          description: `The organization member's email`
        })
      ),
      image_url: v.string({
        name: 'image_url',
        description: `The organization member's image URL`,
        examples: ['https://avatar-cdn.metorial.com/aimg_1234567890']
      }),
      created_at: v.date({
        name: 'created_at',
        description: `The organization member's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The organization member's last update date`
      })
    })
  )
  .build();
