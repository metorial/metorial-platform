import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { managedServerTemplateType } from '../types';

export let v1ManagedServerTemplatePresenter = Presenter.create(managedServerTemplateType)
  .presenter(async ({ managedServerTemplate }, opts) => ({
    object: 'managed_server.template',

    id: managedServerTemplate.id,
    slug: managedServerTemplate.slug,
    name: managedServerTemplate.name,
    created_at: managedServerTemplate.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('managed_server.template'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this managed server template'
      }),

      slug: v.string({
        name: 'slug',
        description: 'The slug identifier for this managed server template'
      }),

      name: v.string({
        name: 'name',
        description: 'The display name of the managed server template'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The timestamp when the managed server template was created'
      })
    })
  )
  .build();
