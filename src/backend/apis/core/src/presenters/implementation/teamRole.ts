import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { teamRoleType } from '../types';

export let v1TeamRolePresenter = Presenter.create(teamRoleType)
  .presenter(async ({ teamRole }, opts) => ({
    object: 'management.team.role',

    id: teamRole.id,

    organization_id: teamRole.organization.id,

    name: teamRole.name,
    slug: teamRole.slug,
    description: teamRole.description,

    permissions: teamRole.scopes,

    created_at: teamRole.createdAt,
    updated_at: teamRole.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('management.team.role'),

      id: v.string({ name: 'id', description: `The role's unique identifier` }),

      organization_id: v.string({
        name: 'organization_id',
        description: `The role's organization ID`
      }),
      name: v.string({
        name: 'name',
        description: `The role's name`
      }),
      slug: v.string({
        name: 'slug',
        description: `The role's slug`
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: `The role's description`
        })
      ),
      permissions: v.array(
        v.string({
          name: 'permission',
          description: `A permission assigned to the role`
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: `The role's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The role's last update date`
      })
    })
  )
  .build();
