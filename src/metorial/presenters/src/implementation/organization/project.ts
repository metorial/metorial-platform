import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectType } from '../../types';

export let v1ProjectPresenter = Presenter.create(projectType)
  .presenter(async ({ project }, opts) => ({
    object: 'organization.project',

    id: project.id,
    status: project.status,
    slug: project.slug,
    name: project.name,
    organization_id: project.organization.id,
    created_at: project.createdAt,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The project's unique identifier`,
        examples: ['prj_3bCdEfGhJkLmNpQr']
      }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The project's status`
      }),
      slug: v.string({
        name: 'slug',
        description: `The project's slug`,
        examples: ['api-integration']
      }),
      name: v.string({
        name: 'name',
        description: `The project's name`,
        examples: ['API Integration']
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization's unique identifier`,
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      created_at: v.date({
        name: 'created_at',
        description: `The project's creation date`,
        examples: [new Date()]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The project's last update date`,
        examples: [new Date()]
      })
    })
  )
  .build();
