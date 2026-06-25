import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { changeNotificationPresenter } from '../presenters/changeNotification';
import { changeNotificationService } from '../services';
import { app } from './_app';

export let changeNotificationApp = app.use(async ctx => {
  let changeNotificationId = ctx.body.changeNotificationId;
  if (!changeNotificationId) throw new Error('Change Notification ID is required');

  let changeNotification = await changeNotificationService.getChangeNotificationById({
    changeNotificationId
  });

  return { changeNotification };
});

export let changeNotificationController = app.controller({
  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          repoId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await changeNotificationService.listChangeNotifications({
        repoId: ctx.input.repoId
      });

      let notifications = await paginator.run(ctx.input);

      return Paginator.presentLight(notifications, changeNotificationPresenter);
    }),

  get: changeNotificationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        changeNotificationId: v.string()
      })
    )
    .do(async ctx => changeNotificationPresenter(ctx.changeNotification))
});
