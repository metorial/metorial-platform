import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { teamType } from '../types';
import { v1ProjectPresenter } from './project';
import { v1TeamRolePresenter } from './teamRole';

export let v1TeamPresenter = Presenter.create(teamType)
  .presenter(async ({ team }, opts) => ({
    object: 'management.team',

    id: team.id,

    organization_id: team.organization.id,

    name: team.name,
    slug: team.slug,
    description: team.description,

    projects: await Promise.all(
      team.projects.map(async a => ({
        id: a.id,

        created_at: a.createdAt,
        updated_at: a.updatedAt,

        project: await v1ProjectPresenter
          .present({ project: { ...a.project, organization: team.organization } }, opts)
          .run(),

        roles: await Promise.all(
          team.assignments
            .filter(p => p.projectOid === a.projectOid)
            .map(async p => ({
              id: p.id,

              role: await v1TeamRolePresenter
                .present(
                  { teamRole: { ...p.teamRole, organization: team.organization } },
                  opts
                )
                .run(),

              created_at: p.createdAt,
              updated_at: p.updatedAt
            }))
        )
      }))
    ),

    created_at: team.createdAt,
    updated_at: team.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('management.team'),

      id: v.string({ name: 'id', description: `The team's unique identifier` }),

      organization_id: v.string({
        name: 'organization_id',
        description: `The team's organization ID`
      }),
      name: v.string({
        name: 'name',
        description: `The team's name`
      }),
      slug: v.string({
        name: 'slug',
        description: `The team's slug`
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: `The team's description`
        })
      ),
      projects: v.array(
        v.object({
          id: v.string({
            name: 'id',
            description: `The team project assignment's unique identifier`
          }),

          created_at: v.date({
            name: 'created_at',
            description: `The team project assignment's creation date`
          }),
          updated_at: v.date({
            name: 'updated_at',
            description: `The team project assignment's last update date`
          }),

          project: v1ProjectPresenter.schema,

          roles: v.array(
            v.object({
              id: v.string({ name: 'id', description: `The role's unique identifier` }),

              role: v1TeamRolePresenter.schema,

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
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: `The team's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The team's last update date`
      })
    })
  )
  .build();
