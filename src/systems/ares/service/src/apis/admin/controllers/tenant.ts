import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { adminService } from '../../../services/admin';
import { adminApp } from '../middleware/admin';
import { tenantPresenter } from '../presenters';

export let tenantController = adminApp.controller({
  list: adminApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          appId: v.string(),
          search: v.optional(v.string())
        })
      )
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let paginator = await adminService.listTenants({ app, search: input.search });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, tenantPresenter);
    }),

  get: adminApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let tenant = await adminService.getTenant({ tenantId: input.id });
      return tenantPresenter(tenant);
    })
});
