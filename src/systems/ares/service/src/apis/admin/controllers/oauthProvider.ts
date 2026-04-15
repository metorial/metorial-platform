import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { adminService } from '../../../services/admin';
import { oauthProviderService } from '../../../services/oauthProvider';
import { adminApp } from '../middleware/admin';
import { oauthProviderPresenter } from '../presenters';

export let oauthProviderController = adminApp.controller({
  list: adminApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          appId: v.string()
        })
      )
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let paginator = await oauthProviderService.list({ app });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, oauthProviderPresenter);
    }),

  create: adminApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        provider: v.enumOf(['github', 'google']),
        clientId: v.string(),
        clientSecret: v.string(),
        redirectUri: v.string()
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let provider = await oauthProviderService.create({
        app,
        input: {
          provider: input.provider,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          redirectUri: input.redirectUri
        }
      });
      return oauthProviderPresenter(provider);
    }),

  update: adminApp
    .handler()
    .input(
      v.object({
        id: v.string(),
        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string()),
        redirectUri: v.optional(v.string()),
        enabled: v.optional(v.boolean())
      })
    )
    .do(async ({ input }) => {
      let provider = await oauthProviderService.get({ providerId: input.id });
      let updated = await oauthProviderService.update({
        provider,
        input: {
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          redirectUri: input.redirectUri,
          enabled: input.enabled
        }
      });
      return oauthProviderPresenter(updated);
    }),

  delete: adminApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let provider = await oauthProviderService.get({ providerId: input.id });
      await oauthProviderService.delete({ provider });
      return { success: true };
    })
});
