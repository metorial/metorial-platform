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
      object: v.literal('secret', { description: "String representing the object's type" }),

      id: v.string({ name: 'id', description: `The secret's unique identifier`, examples: ['sec_2pQrStUvWxYzAbCd'] }),
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
        examples: ['Production database connection string']
      }),
      metadata: v.record(v.any(), {
        name: 'metadata',
        description: `The secret's metadata`,
        examples: [{ environment: 'production' }, { service: 'api', region: 'us-east-1' }]
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The secret's organization identifier`,
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      instance_id: v.string({
        name: 'instance_id',
        description: `The secret's instance identifier`,
        examples: ['ins_9sTuVwXyZaBcDeFg']
      }),
      fingerprint: v.string({
        name: 'fingerprint',
        description: `The secret's fingerprint`,
        examples: ['sha256:a3b8c2d9e4f5']
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
