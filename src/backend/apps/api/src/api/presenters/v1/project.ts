import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { projectType } from '../types';

export let v1ProjectPresenter = Presenter.create(projectType)
  .presenter(async ({ project }, opts) => ({
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
      id: v.string({ name: 'id', description: `The project's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The project's status`
      }),
      slug: v.string({ name: 'slug', description: `The project's slug` }),
      name: v.string({ name: 'name', description: `The project's name` }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization's unique identifier`
      }),
      created_at: v.date({ name: 'created_at', description: `The project's creation date` }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The project's last update date`
      })
    })
  )
  .build();
