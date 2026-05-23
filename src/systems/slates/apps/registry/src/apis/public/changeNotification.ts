import { createHono } from '@mtsrc/hono';
import { Paginator } from '@mtsrc/pagination';
import { z } from 'zod';
import { paginatorSchema } from '../../lib/paginatorSchema';
import { useValidation } from '../../lib/validator';
import { changeNotificationPresenter } from '../../presenters';
import { changeNotificationService } from '../../services';
import { useAuth } from './_app';

export let changeNotificationsController = createHono()
  .get(
    '',
    useValidation(
      'query',
      paginatorSchema.extend({
        supports_prebuilt: z.coerce.boolean().optional()
      })
    ),
    async c => {
    let auth = await useAuth(c);
    let query = c.req.valid('query');

    let paginator = await changeNotificationService.listChangeNotifications({
      tenant: auth.tenant,
      subRegistry: auth.subRegistry,
      supportsPrebuilt: query.supports_prebuilt === true
    });
    let list = await paginator.run(query);

    return c.json(await Paginator.presentLight(list, changeNotificationPresenter));
  }
  )
  .get(
    ':changeNotificationId',
    useValidation(
      'query',
      z.object({
        supports_prebuilt: z.coerce.boolean().optional()
      })
    ),
    async c => {
    let auth = await useAuth(c);
    let query = c.req.valid('query');

    let slate = await changeNotificationService.getChangeNotificationById({
      id: c.req.param('changeNotificationId'),
      tenant: auth.tenant,
      subRegistry: auth.subRegistry,
      supportsPrebuilt: query.supports_prebuilt === true
    });

    return c.json(await changeNotificationPresenter(slate));
  }
  );
