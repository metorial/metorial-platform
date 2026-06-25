import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { adminService } from '../../../services/admin';
import { internalApp } from '../_app';
import { appPresenter } from '../presenters';

export let appController = internalApp.controller({
  list: internalApp
    .handler()
    .input(Paginator.validate())
    .do(async ({ input }) => {
      let paginator = await adminService.listApps();
      let list = await paginator.run(input);
      return Paginator.presentLight(list, appPresenter);
    }),

  get: internalApp
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

  create: internalApp
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

  upsert: internalApp
    .handler()
    .input(
      v.object({
        defaultRedirectUrl: v.string(),
        slug: v.string(),
        redirectDomains: v.optional(v.array(v.string())),
        isSessionless: v.optional(v.boolean()),
        disableEmailAuth: v.optional(v.boolean())
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.upsertApp(input);
      return appPresenter(app);
    }),

  update: internalApp
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
