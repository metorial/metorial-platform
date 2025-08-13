import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { secretType } from '../types';

export let v1SecretPresenter = Presenter.create(secretType)
  .presenter(async ({ secret }, opts) => ({
    object: 'secret',

    id: secret.id,
    status: secret.status,
    type: {
      identifier: secret.type.slug,
      name: secret.type.name
    },

    description: secret.description,
    metadata: secret.metadata ?? {},

    organization_id: secret.organization.id,
    instance_id: secret.instance.id,
    fingerprint: secret.fingerprint,

    created_at: secret.createdAt,
    last_used_at: secret.lastUsedAt
  }))
  .schema(
    v.object({
      object: v.literal('secret'),

      id: v.string({ name: 'id', description: `The secret's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The secret's status`
      }),
      type: v.object({
        identifier: v.string({
          name: 'identifier',
          description: `The secret's type identifier`
        }),
        name: v.string({
          name: 'name',
          description: `The secret's type name`
        })
      }),
      description: v.string({
        name: 'description',
        description: `The secret's description`,
        examples: ['This is a secret']
      }),
      metadata: v.record(v.any(), {
        name: 'metadata',
        description: `The secret's metadata`,
        examples: [{ key: 'value' }, { key: 'value', key2: 'value2' }]
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The secret's organization identifier`
      }),
      instance_id: v.string({
        name: 'instance_id',
        description: `The secret's instance identifier`
      }),
      fingerprint: v.string({
        name: 'fingerprint',
        description: `The secret's fingerprint`,
        examples: ['1234567890abcdef']
      }),
      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description: `The secret's last used date`
        })
      ),
      created_at: v.date({ name: 'created_at', description: `The secret's creation date` })
    })
  )
  .build();
