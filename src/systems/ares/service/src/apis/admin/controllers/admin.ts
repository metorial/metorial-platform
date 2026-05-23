import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { adminService } from '../../../services/admin';
import { adminApp } from '../middleware/admin';
import { adminPresenter } from '../presenters';

export let adminController = adminApp.controller({
  list: adminApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          search: v.optional(v.string())
        })
      )
    )
    .do(async ({ input }) => {
      let paginator = await adminService.listAdmins({ search: input.search });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, adminPresenter);
    })
});
