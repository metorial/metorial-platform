import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { namespaceType } from '../../types';

export let v1NamespacePresenter = Presenter.create(namespaceType)
  .presenter(async ({ namespace }, opts) => ({
    object: 'namespace',

    id: namespace.id,
    value: namespace.value,
    purposes: namespace.purposes,

    compartment: {
      object: 'namespace.compartment' as const,
      id: namespace.compartment.id,
      type: namespace.compartment.type,
      priority: namespace.compartment.priority,
      value: namespace.compartment.value
    },

    created_at: namespace.createdAt,
    updated_at: namespace.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('namespace', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The namespace's unique identifier`,
        examples: ['nsp_7hNkPqRsTuVwXyZa']
      }),
      value: v.string({
        name: 'value',
        description: `The namespace's value within its compartment`,
        examples: ['acme-corp']
      }),
      purposes: v.array(v.enumOf(['metorial_platform', 'metorial_portal']), {
        name: 'purposes',
        description: `The purposes the namespace can be used for`
      }),

      compartment: v.object({
        object: v.literal('namespace.compartment', {
          description: "String representing the object's type"
        }),

        id: v.string({
          name: 'id',
          description: `The compartment's unique identifier`,
          examples: ['nspc_7hNkPqRsTuVwXyZa']
        }),
        type: v.enumOf(['managed'], {
          name: 'type',
          description: `The compartment's type`
        }),
        priority: v.number({
          name: 'priority',
          description: `The compartment's priority. Namespaces in higher priority compartments are preferred`
        }),
        value: v.string({
          name: 'value',
          description: `The compartment's value, usually the domain the namespace is hosted on`,
          examples: ['metorial.com']
        })
      }),

      created_at: v.date({
        name: 'created_at',
        description: `The namespace's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The namespace's last update date`
      })
    })
  )
  .build();
