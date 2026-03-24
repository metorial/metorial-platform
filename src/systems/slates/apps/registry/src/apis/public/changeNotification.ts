import { createHono } from '@lowerdeck/hono';
import { Paginator } from '@lowerdeck/pagination';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { useValidation } from '../../lib/validator';
import { changeNotificationPresenter } from '../../presenters';
import { changeNotificationService } from '../../services';
import { useAuth } from './_app';

export let changeNotificationsController = createHono()
  .get('', useValidation('query', paginatorSchema), async c => {
    let auth = await useAuth(c);
    let query = c.req.valid('query');

    let paginator = await changeNotificationService.listChangeNotifications({
      tenant: auth.tenant,
      subRegistry: auth.subRegistry
    });
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, changeNotificationPresenter));
  })
  .get(':changeNotificationId', async c => {
    let auth = await useAuth(c);

    let slate = await changeNotificationService.getChangeNotificationById({
      id: c.req.param('changeNotificationId'),
      tenant: auth.tenant,
      subRegistry: auth.subRegistry
    });

    return c.json(await changeNotificationPresenter(slate));
  });
