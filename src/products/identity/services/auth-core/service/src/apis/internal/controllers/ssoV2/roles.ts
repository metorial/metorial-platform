import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { ssoGroupRoleService } from '../../../../services/sso/groupRole';
import { ssoRolePresenter } from '../../presenters';
import { tenantApp } from './_middleware';

export let ssoRolesController = tenantApp.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        value: v.string(),
        displayName: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ({ input, tenant }) => {
      let role = await ssoGroupRoleService.upsertRootRole({
        tenant,
        value: input.value,
        displayName: input.displayName,
        metadata: input.metadata
      });
      return ssoRolePresenter(role);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          userIds: v.optional(v.array(v.string())),
          userProfileIds: v.optional(v.array(v.string())),
          connectionIds: v.optional(v.array(v.string())),
          directoryIds: v.optional(v.array(v.string())),
          roleIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ({ input, tenant }) => {
      let paginator = await ssoGroupRoleService.listRootRoles({
        tenant,
        filters: input
      });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoRolePresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        roleId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let role = await ssoGroupRoleService.getRootRoleById({
        tenant,
        roleId: input.roleId
      });
      return ssoRolePresenter(role);
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        roleId: v.string(),
        value: v.optional(v.string()),
        displayName: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ({ input, tenant }) => {
      let role = await ssoGroupRoleService.getRootRoleById({
        tenant,
        roleId: input.roleId
      });
      let updated = await ssoGroupRoleService.updateRootRole({
        tenant,
        role,
        input: {
          value: input.value,
          displayName: input.displayName,
          metadata: input.metadata
        }
      });
      return ssoRolePresenter(updated);
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        roleId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let role = await ssoGroupRoleService.getRootRoleById({
        tenant,
        roleId: input.roleId
      });
      let deleted = await ssoGroupRoleService.deleteRootRole({ tenant, role });
      return ssoRolePresenter(deleted);
    })
});
