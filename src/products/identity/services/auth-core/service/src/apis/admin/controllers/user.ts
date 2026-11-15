import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { adminService } from '../../../services/admin';
import { userPresenter } from '../../auth/presenters';
import { adminApp } from '../middleware/admin';
import { adminUserPresenter } from '../presenters';

export let userController = adminApp.controller({
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
      let paginator = await adminService.listUsers({ app, search: input.search });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, userPresenter);
    }),

  get: adminApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let user = await adminService.getUser({ userId: input.id });
      return await adminUserPresenter(user);
    })
});
