import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { outpostType } from '../../types';

export let v1OutpostPresenter = Presenter.create(outpostType)
  .presenter(async ({ outpost }) => ({
    object: 'outpost',

    id: outpost.id,
    status: outpost.status,
    connection_status: outpost.connectionStatus,

    organization_id: outpost.organization.id,

    name: outpost.name,
    description: outpost.description,

    instance_count: outpost.instanceCount,
    last_seen_at: outpost.lastSeenAt,

    created_at: outpost.createdAt,
    updated_at: outpost.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('outpost', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The outpost's unique identifier`,
        examples: ['otp_4fGhJkLmNpQrStUv']
      }),
      status: v.enumOf(['active', 'disabled', 'deleted'], {
        name: 'status',
        description: `The outpost's status`
      }),
      connection_status: v.enumOf(['active', 'inactive'], {
        name: 'connection_status',
        description: `Whether the outpost is currently connected`
      }),

      organization_id: v.string({
        name: 'organization_id',
        description: `The id of the organization that owns this outpost`
      }),

      name: v.string({
        name: 'name',
        description: `The outpost's name`,
        examples: ['Production Outpost']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: `The outpost's description`
        })
      ),

      instance_count: v.number({
        name: 'instance_count',
        description: `The number of instances currently registered with this outpost`
      }),
      last_seen_at: v.nullable(
        v.date({
          name: 'last_seen_at',
          description: `The last time this outpost was seen`
        })
      ),

      created_at: v.date({ name: 'created_at', description: `The outpost's creation date` }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The outpost's last update date`
      })
    })
  )
  .build();
