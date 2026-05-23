import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { machineAccessType } from '../../types';
import { v1InstancePresenter } from '../organization/instance';
import { v1OrganizationPresenter } from '../organization/organization';
import { v1OrganizationActorPresenter } from '../organization/organizationActor';
import { v1UserPresenter } from '../organization/user';

export let v1MachineAccessPresenter = Presenter.create(machineAccessType)
  .presenter(async ({ machineAccess }, opts) => ({
    object: 'machine_access',

    id: machineAccess.id,
    status: machineAccess.status,
    type: machineAccess.type,
    name: machineAccess.name,

    last_used_at: machineAccess.lastUsedAt,
    created_at: machineAccess.createdAt,
    updated_at: machineAccess.updatedAt,
    deleted_at: machineAccess.deletedAt,

    actor:
      machineAccess.actor && machineAccess.organization
        ? await v1OrganizationActorPresenter
            .present(
              {
                organizationActor: {
                  ...machineAccess.actor,
                  organization: machineAccess.organization
                }
              },
              opts
            )
            .run()
        : null,

    instance:
      machineAccess.instance && machineAccess.organization
        ? await v1InstancePresenter
            .present(
              {
                instance: {
                  ...machineAccess.instance,
                  organization: machineAccess.organization
                }
              },
              opts
            )
            .run()
        : null,

    organization: machineAccess.organization
      ? await v1OrganizationPresenter
          .present(
            {
              organization: machineAccess.organization
            },
            opts
          )
          .run()
      : null,

    user: machineAccess.user
      ? await v1UserPresenter
          .present(
            {
              user: machineAccess.user
            },
            opts
          )
          .run()
      : null
  }))
  .schema(
    v.object({
      object: v.literal('machine_access', {
        description: "String representing the object's type"
      }),

      id: v.string({ name: 'id', description: `The machineAccess's unique identifier` }),

      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The machineAccess's status`
      }),

      type: v.enumOf(['organization_management', 'instance_secret', 'instance_publishable'], {
        name: 'type',
        description: `The machineAccess's type`
      }),

      name: v.string({ name: 'name', description: `The machineAccess's name` }),

      last_used_at: v.date({
        name: 'last_used_at',
        description: `The machineAccess's last used date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      created_at: v.date({
        name: 'created_at',
        description: `The machineAccess's creation date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: `The machineAccess's last update date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      deleted_at: v.date({
        name: 'deleted_at',
        description: `The machineAccess's deletion date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      actor: v.nullable(v1OrganizationActorPresenter.schema),

      instance: v.nullable(v1InstancePresenter.schema),

      organization: v.nullable(v1OrganizationPresenter.schema),

      user: v.nullable(v1UserPresenter.schema)
    })
  )
  .build();
