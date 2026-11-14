import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { changeNotificationPresenter } from '../../presenters';
import { changeNotificationService } from '../../services';
import { app } from './_app';

export let changeNotificationApp = app.use(async ctx => {
  let changeNotificationId = ctx.body.changeNotificationId;
  if (!changeNotificationId) throw new Error('changeNotificationId is required');

  let changeNotification = await changeNotificationService.getChangeNotificationById({
    changeNotificationId
  });

  return { changeNotification };
});

export let changeNotificationController = app.controller({
  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await changeNotificationService.listChangeNotifications({});

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
