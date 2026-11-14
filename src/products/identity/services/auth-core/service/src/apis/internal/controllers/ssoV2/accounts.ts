import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { accountService } from '../../../../services/account';
import { adminService } from '../../../../services/admin';
import { internalApp } from '../../_app';
import { accountPresenter } from '../../presenters';

let accountRestrictionInput = v.union([
  v.object({
    type: v.literal('connection'),
    connectionId: v.string()
  }),
  v.object({
    type: v.literal('tenant'),
    tenantId: v.string()
  })
]);

let accountDomainInput = v.object({
  domain: v.string({
    modifiers: [
      v.regex(/^(?!.*[@\s])(?=.{1,253}$)(?!.*\.$).+$/, {
        message: 'Account domain must be a valid hostname'
      })
    ]
  }),
  restrictions: v.optional(v.array(accountRestrictionInput))
});

export let accountsController = internalApp.controller({
  list: internalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          appId: v.string(),
          identifier: v.optional(v.string()),
          search: v.optional(v.string()),
          status: v.optional(v.enumOf(['active', 'deleting']))
        })
      )
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let paginator = await accountService.listAccounts({
        app,
        filters: input
      });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, accountPresenter);
    }),

  get: internalApp
    .handler()
    .input(
      v.object({
        accountId: v.string()
      })
    )
    .do(async ({ input }) => {
      let account = await accountService.getAccountById({
        accountId: input.accountId
      });
      return accountPresenter(account);
    }),

  upsert: internalApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        identifier: v.string(),
        name: v.string(),
        allowEmailLogin: v.optional(v.boolean()),
        allowSocialLogin: v.optional(v.boolean()),
        ssoTenants: v.array(v.object({ id: v.string() })),
        accountDomains: v.array(accountDomainInput)
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let account = await accountService.upsertAccount({
        app,
        input: {
          identifier: input.identifier,
          name: input.name,
          allowEmailLogin: input.allowEmailLogin,
          allowSocialLogin: input.allowSocialLogin,
          ssoTenants: input.ssoTenants,
          accountDomains: input.accountDomains
        }
      });
      return accountPresenter(account);
    }),

  delete: internalApp
    .handler()
    .input(
      v.object({
        accountId: v.string()
      })
    )
    .do(async ({ input }) => {
      let account = await accountService.getAccountById({
        accountId: input.accountId
      });
      let deleting = await accountService.deleteAccount({ account });
      return {
        id: deleting.id,
        status: deleting.status
      };
    })
});
