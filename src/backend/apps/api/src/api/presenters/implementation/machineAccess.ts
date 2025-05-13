import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { machineAccessType } from '../types';
import { v1InstancePresenter } from './instance';
import { v1OrganizationPresenter } from './organization';
import { v1OrganizationActorPresenter } from './organizationActor';
import { v1UserPresenter } from './user';

export let v1MachineAccessPresenter = Presenter.create(machineAccessType)
  .presenter(async ({ machineAccess }, opts) => ({
    id: machineAccess.id,
    status: machineAccess.status,
    type: machineAccess.type,
    name: machineAccess.name,

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
    organization_id: machineAccess.organization
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
      : null,

    deleted_at: machineAccess.deletedAt,
    last_used_at: machineAccess.lastUsedAt,
    created_at: machineAccess.createdAt,
    updated_at: machineAccess.updatedAt
  }))
  .schema(
    v.object({
      id: v.string({ name: 'id', description: `The machineAccess's unique identifier` }),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The machineAccess's status`
      }),
      type: v.enumOf(
        [
          'user_auth_token',
          'organization_management',
          'instance_secret',
          'instance_publishable'
        ],
        {
          name: 'type',
          description: `The machineAccess's type`
        }
      ),
      name: v.string({ name: 'name', description: `The machineAccess's name` }),
      actor: v.nullable(v1OrganizationActorPresenter.schema),
      instance: v.nullable(v1InstancePresenter.schema),
      organization_id: v.nullable(v1OrganizationPresenter.schema),
      user: v.nullable(v1UserPresenter.schema),
      deleted_at: v.date({
        name: 'deleted_at',
        description: `The machineAccess's deletion date`
      }),
      last_used_at: v.date({
        name: 'last_used_at',
        description: `The machineAccess's last used date`
      }),
      created_at: v.date({
        name: 'created_at',
        description: `The machineAccess's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The machineAccess's last update date`
      })
    })
  )
  .build();
