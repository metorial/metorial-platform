import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { instanceListType, instanceType } from '../../types';
import { v1ProjectPresenter } from '../organization/project';

export let v1InstancePresenter = Presenter.create(instanceType)
  .presenter(async ({ instance }, opts) => ({
    object: 'organization.instance',

    id: instance.id,
    slug: instance.slug,
    name: instance.name,
    organization_id: instance.organization.id,
    sandbox_id: instance.sandbox?.id ?? null,
    type: instance.type,
    created_at: new Date(instance.createdAt),
    updated_at: new Date(instance.updatedAt),

    project: await v1ProjectPresenter
      .present({ project: { ...instance.project, organization: instance.organization } }, opts)
      .run()
  }))
  .schema(
    v.object({
      object: v.literal('organization.instance', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The instance's unique identifier`,
        examples: ['ins_9sTuVwXyZaBcDeFg']
      }),
      slug: v.string({
        name: 'slug',
        description: `The instance's slug`,
        examples: ['production-env']
      }),
      name: v.string({
        name: 'name',
        description: `The instance's name`,
        examples: ['Production Environment']
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization's unique identifier`,
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      sandbox_id: v.nullable(
        v.string({
          name: 'sandbox_id',
          description: `The sandbox's unique identifier, if this instance is a sandbox`,
          examples: ['sbx_9sTuVwXyZaBcDeFg']
        })
      ),
      type: v.enumOf(['development', 'production'], {
        name: 'type',
        description: `The instance's type`
      }),
      created_at: v.date({
        name: 'created_at',
        description: `The instance's creation date`,
        examples: [new Date('2026-01-29T12:35:22.304Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The instance's last update date`,
        examples: [new Date('2026-01-29T12:35:22.304Z')]
      }),
      project: v1ProjectPresenter.schema
    })
  )
  .build();

export let v1InstanceListPresenter = Presenter.create(instanceListType)
  .presenter(async ({ instances }, opts) => ({
    object: 'list',

    items: await Promise.all(
      instances.map(instance => v1InstancePresenter.present({ instance }, opts).run())
    )
  }))
  .schema(
    v.object({
      object: v.literal('list', {
        description: "String representing the object's type"
      }),
      items: v.array(v1InstancePresenter.schema, {
        name: 'items',
        description: 'The list of instances'
      })
    })
  )
  .build();
