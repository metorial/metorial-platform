import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { teamType } from '../../types';
import { v1AccessPolicyPreviewPresenter } from '../accessControl/accessPolicyPreview';
import { v1ProjectPresenter } from './project';

export let v1TeamPresenter = Presenter.create(teamType)
  .presenter(async ({ team }, opts) => ({
    object: 'management.team',

    id: team.id,

    organization_id: team.organization.id,

    name: team.name,
    slug: team.slug,
    description: team.description,
    policies: await Promise.all(
      (team.policies ?? []).map(assignment =>
        v1AccessPolicyPreviewPresenter
          .present({ accessPolicy: assignment.accessPolicy }, opts)
          .run()
      )
    ),

    projects: await Promise.all(
      team.projects.map(async a => ({
        id: a.id,

        created_at: a.createdAt,
        updated_at: a.updatedAt,

        project: await v1ProjectPresenter
          .present({ project: { ...a.project, organization: team.organization } }, opts)
          .run()
      }))
    ),

    created_at: team.createdAt,
    updated_at: team.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('management.team', {
        description: "String representing the team object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The team's unique identifier`,
        examples: ['tm_7hNkPqRsTuVwXyZa']
      }),

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
      policies: v.array(v1AccessPolicyPreviewPresenter.schema, {
        name: 'policies',
        description: 'Access policies currently assigned to this team'
      }),
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

          project: v1ProjectPresenter.schema
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
