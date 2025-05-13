import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { instanceType } from '../types';
import { v1ProjectPresenter } from './project';

export let v1InstancePresenter = Presenter.create(instanceType)
  .presenter(async ({ instance }, opts) => ({
    id: instance.id,
    status: instance.status,
    slug: instance.slug,
    name: instance.name,
    organization_id: instance.organization.id,
    type: instance.type,
    created_at: instance.createdAt,
    updated_at: instance.updatedAt,

    project: await v1ProjectPresenter
      .present({ project: { ...instance.project, organization: instance.organization } }, opts)
      .run()
  }))
  .schema(
    v.object({
      id: v.string({ name: 'id', description: `The instance's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The instance's status`
      }),
      slug: v.string({ name: 'slug', description: `The instance's slug` }),
      name: v.string({ name: 'name', description: `The instance's name` }),
      type: v.enumOf(['development', 'production'], {
        name: 'type',
        description: `The instance's type`
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization's unique identifier`
      }),
      project: v1ProjectPresenter.schema,
      created_at: v.date({ name: 'created_at', description: `The instance's creation date` }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The instance's last update date`
      })
    })
  )
  .build();
