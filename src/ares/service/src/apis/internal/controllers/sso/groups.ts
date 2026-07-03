import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { ssoGroupRoleService } from '../../../../services/sso/groupRole';
import { ssoGroupPresenter } from '../../presenters';
import { tenantApp } from './_middleware';

export let ssoGroupsController = tenantApp.controller({
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
      let group = await ssoGroupRoleService.upsertRootGroup({
        tenant,
        value: input.value,
        displayName: input.displayName,
        metadata: input.metadata
      });
      return ssoGroupPresenter(group);
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
          groupIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ({ input, tenant }) => {
      let paginator = await ssoGroupRoleService.listRootGroups({
        tenant,
        filters: input
      });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoGroupPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        groupId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let group = await ssoGroupRoleService.getRootGroupById({
        tenant,
        groupId: input.groupId
      });
      return ssoGroupPresenter(group);
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        groupId: v.string(),
        value: v.optional(v.string()),
        displayName: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ({ input, tenant }) => {
      let group = await ssoGroupRoleService.getRootGroupById({
        tenant,
        groupId: input.groupId
      });
      let updated = await ssoGroupRoleService.updateRootGroup({
        tenant,
        group,
        input: {
          value: input.value,
          displayName: input.displayName,
          metadata: input.metadata
        }
      });
      return ssoGroupPresenter(updated);
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        groupId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let group = await ssoGroupRoleService.getRootGroupById({
        tenant,
        groupId: input.groupId
      });
      let deleted = await ssoGroupRoleService.deleteRootGroup({ tenant, group });
      return ssoGroupPresenter(deleted);
    })
});
