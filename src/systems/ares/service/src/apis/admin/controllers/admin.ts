import { Paginator } from '@lowerdeck/pagination';
import { adminService } from '../../../services/admin';
import { adminApp } from '../middleware/admin';
import { adminPresenter } from '../presenters';

export let adminController = adminApp.controller({
  list: adminApp
    .handler()
    .input(Paginator.validate())
    .do(async ({ input }) => {
      let paginator = await adminService.listAdmins();
      let list = await paginator.run(input);
      return Paginator.presentLight(list, adminPresenter);
    })
});
