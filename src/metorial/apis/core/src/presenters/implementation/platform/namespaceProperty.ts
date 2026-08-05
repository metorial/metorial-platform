import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { namespacePropertyType } from '../../types';
import { v1NamespacePresenter } from './namespace';

export let v1NamespacePropertyPresenter = Presenter.create(namespacePropertyType)
  .presenter(async ({ namespaceProperty }, opts) => ({
    object: 'namespace.property',

    id: namespaceProperty.id,
    type: namespaceProperty.type,

    namespace: await v1NamespacePresenter
      .present({ namespace: namespaceProperty.namespace }, opts)
      .run(),

    created_at: namespaceProperty.createdAt,
    updated_at: namespaceProperty.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('namespace.property', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The namespace property's unique identifier`,
        examples: ['nspp_7hNkPqRsTuVwXyZa']
      }),
      type: v.enumOf(['organization', 'portal'], {
        name: 'type',
        description: `The kind of entity the namespace is assigned to`
      }),

      namespace: v1NamespacePresenter.schema,

      created_at: v.date({
        name: 'created_at',
        description: `The namespace property's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The namespace property's last update date`
      })
    })
  )
  .build();
