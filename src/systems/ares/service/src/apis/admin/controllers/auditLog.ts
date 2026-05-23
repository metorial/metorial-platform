import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { adminService } from '../../../services/admin';
import { auditLogService } from '../../../services/auditLog';
import { adminApp } from '../middleware/admin';
import { auditLogPresenter } from '../presenters';

export let auditLogController = adminApp.controller({
  list: adminApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          appId: v.string(),
          type: v.optional(v.string())
        })
      )
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let paginator = await auditLogService.list({ app, type: input.type });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, auditLogPresenter);
    })
});
