import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { organizationActorType } from '../../types';

export let v1OrganizationActorPresenter = Presenter.create(organizationActorType)
  .presenter(async ({ organizationActor }, opts) => ({
    object: 'organization.actor',

    id: organizationActor.id,
    type: organizationActor.type,

    organization_id: organizationActor.organization.id,

    name: organizationActor.name,
    email: organizationActor.email,
    image_url: await getImageUrl(organizationActor),

    teams:
      organizationActor.teams?.map(t => ({
        id: t.team.id,
        name: t.team.name,
        slug: t.team.slug,
        assignment_id: t.id,
        created_at: t.createdAt,
        updated_at: t.updatedAt
      })) ?? null,

    created_at: organizationActor.createdAt,
    updated_at: organizationActor.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.actor', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The organization member's unique identifier`,
        examples: ['omem_5fGhJkLmNpQrStUv']
      }),
      type: v.enumOf(['member', 'machine_access'], {
        name: 'type',
        description: `The organization member's type`
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization member's organization ID`,
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      name: v.string({
        name: 'name',
        description: `The organization member's name`,
        examples: ['Alex Chen']
      }),
      email: v.nullable(
        v.string({
          name: 'email',
          description: `The organization member's email`,
          examples: ['alex.chen@acme.com']
        })
      ),
      image_url: v.string({
        name: 'image_url',
        description: `The organization member's image URL`,
        examples: ['https://avatar-cdn.metorial.com/aimg_1234567890']
      }),

      teams: v.array(
        v.object(
          {
            id: v.string({
              name: 'id',
              description: `The team ID`,
              examples: ['tm_3eFgHjKlMnPqRsTu']
            }),
            name: v.string({
              name: 'name',
              description: `The team name`,
              examples: ['Engineering']
            }),
            slug: v.string({
              name: 'slug',
              description: `The team slug`,
              examples: ['engineering']
            }),
            assignment_id: v.string({
              name: 'assignment_id',
              description: `The team assignment ID`,
              examples: ['tmas_8jKlMnPqRsTuVwXy']
            }),
            created_at: v.date({
              name: 'created_at',
              description: `The team assignment creation date`
            }),
            updated_at: v.date({
              name: 'updated_at',
              description: `The team assignment last update date`
            })
          },
          {
            name: 'teams',
            description: `The teams the actor belongs to`
          }
        )
      ),

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
