import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { ssoIdentityService } from '../../../../services/sso/identity';
import { ssoUserPresenter, ssoUserUpdatePresenter } from '../../presenters';
import { tenantApp } from './_middleware';

export let ssoUsersController = tenantApp.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          userIds: v.optional(v.array(v.string())),
          userProfileIds: v.optional(v.array(v.string())),
          connectionIds: v.optional(v.array(v.string())),
          groupIds: v.optional(v.array(v.string())),
          roleIds: v.optional(v.array(v.string())),
          uids: v.optional(v.array(v.string())),
          directoryIds: v.optional(v.array(v.string())),
          externalIds: v.optional(v.array(v.string())),
          emails: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ({ input, tenant }) => {
      let paginator = await ssoIdentityService.listUsers({
        tenant,
        filters: input
      });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoUserPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        userId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let user = await ssoIdentityService.getUserById({
        tenant,
        userId: input.userId
      });
      return ssoUserPresenter(user);
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        userId: v.string(),
        email: v.optional(v.string()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        status: v.optional(v.enumOf(['active', 'deprovisioned']))
      })
    )
    .do(async ({ input, tenant }) => {
      let user = await ssoIdentityService.getUserById({
        tenant,
        userId: input.userId
      });
      let updated = await ssoIdentityService.updateUser({
        tenant,
        user,
        input: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          status: input.status
        }
      });
      return ssoUserPresenter(updated);
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        userId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let user = await ssoIdentityService.getUserById({
        tenant,
        userId: input.userId
      });
      let deleted = await ssoIdentityService.deleteUser({ tenant, user });
      return ssoUserPresenter(deleted);
    }),

  updates: tenantApp.controller({
    list: tenantApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            tenantId: v.string(),
            userIds: v.optional(v.array(v.string())),
            emails: v.optional(v.array(v.string())),
            statuses: v.optional(v.array(v.string()))
          })
        )
      )
      .do(async ({ input, tenant }) => {
        let paginator = await ssoIdentityService.listUserUpdates({
          tenant,
          filters: input
        });
        let list = await paginator.run(input);
        return Paginator.presentLight(list, ssoUserUpdatePresenter);
      }),

    get: tenantApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          userUpdateId: v.string()
        })
      )
      .do(async ({ input, tenant }) => {
        let update = await ssoIdentityService.getUserUpdateById({
          tenant,
          userUpdateId: input.userUpdateId
        });
        return ssoUserUpdatePresenter(update);
      })
  })
});
