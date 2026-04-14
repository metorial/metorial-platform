import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { adminService } from '../../../services/admin';
import { adminApp } from '../middleware/admin';
import { appPresenter } from '../presenters';

export let appController = adminApp.controller({
  list: adminApp
    .handler()
    .input(Paginator.validate())
    .do(async ({ input }) => {
      let paginator = await adminService.listApps();
      let list = await paginator.run(input);
      return Paginator.presentLight(list, appPresenter);
    }),

  get: adminApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.id });
      return appPresenter(app);
    }),

  create: adminApp
    .handler()
    .input(
      v.object({
        defaultRedirectUrl: v.string(),
        slug: v.optional(v.string()),
        redirectDomains: v.optional(v.array(v.string())),
        isSessionless: v.optional(v.boolean()),
        disableEmailAuth: v.optional(v.boolean())
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.createApp(input);
      return appPresenter(app);
    }),

  update: adminApp
    .handler()
    .input(
      v.object({
        id: v.string(),
        slug: v.optional(v.string()),
        redirectDomains: v.optional(v.array(v.string())),
        isSessionless: v.optional(v.boolean()),
        disableEmailAuth: v.optional(v.boolean())
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.id });
      let updated = await adminService.updateApp({
        app,
        input: {
          slug: input.slug,
          redirectDomains: input.redirectDomains,
          isSessionless: input.isSessionless,
          disableEmailAuth: input.disableEmailAuth
        }
      });
      return appPresenter(updated);
    })
});
