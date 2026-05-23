import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { changeNotificationPresenter } from '../../presenters';
import { changeNotificationService } from '../../services';
import { app } from './_app';

export let changeNotificationApp = app.use(async ctx => {
  let changeNotificationId = ctx.body.changeNotificationId;
  if (!changeNotificationId) throw new Error('ChangeNotification ID is required');

  let changeNotification = await changeNotificationService.getChangeNotificationById({
    id: changeNotificationId
  });

  return { changeNotification };
});

export let changeNotificationController = app.controller({
  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await changeNotificationService.listChangeNotifications();

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, changeNotificationPresenter);
    }),

  get: changeNotificationApp
    .handler()
    .input(
      v.object({
        changeNotificationId: v.string()
      })
    )
    .do(async ctx => changeNotificationPresenter(ctx.changeNotification))
});
