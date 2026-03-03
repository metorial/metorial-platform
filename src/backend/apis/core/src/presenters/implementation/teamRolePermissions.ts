import { Presenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';
import { teamRolePermissionsType } from '../types';

export let v1TeamRolePermissionsPresenter = Presenter.create(teamRolePermissionsType)
  .presenter(async ({ permissions }, opts) => ({
    object: 'management.team.role_permissions',

    permissions
  }))
  .schema(
    v.object({
      object: v.literal('management.team.role_permissions', {
        description: "String representing the object's type"
      }),

      permissions: v.array(
        v.object({
          identifier: v.string({
            name: 'identifier',
            description: `The permission identifier`
          }),
          name: v.string({
            name: 'name',
            description: `The permission's name`
          }),
          description: v.string({
            name: 'description',
            description: `A short description of what the permission allows`
          }),
          dependencies: v.array(v.string())
        })
      )
    })
  )
  .build();
