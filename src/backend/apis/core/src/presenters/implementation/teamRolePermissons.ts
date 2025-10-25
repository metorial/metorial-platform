import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { teamRolePermissionsType } from '../types';

export let v1TeamRolePermissionsPresenter = Presenter.create(teamRolePermissionsType)
  .presenter(async ({ permissions }, opts) => ({
    object: 'management.team.role_permissions',

    permissions: permissions.map(p => ({
      id: p,
      name: p
    }))
  }))
  .schema(
    v.object({
      object: v.literal('management.team.role_permissions'),

      permissions: v.array(
        v.object({
          id: v.string({
            name: 'id',
            description: `The permission's unique identifier`
          }),
          name: v.string({
            name: 'name',
            description: `The permission's name`
          })
        })
      )
    })
  )
  .build();
