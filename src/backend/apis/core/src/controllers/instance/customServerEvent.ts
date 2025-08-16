import { customServerEventService } from '@metorial/module-custom-server';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { customServerEventPresenter } from '../../presenters';
import { customServerGroup } from './customServer';

export let customServerEventController = Controller.create(
  {
    name: 'Custom Server',
    description: 'Manager custom server events',
    hideInDocs: true
  },
  {
    list: customServerGroup
      .get(
        instancePath('custom-servers/:customServerId/events', 'custom_servers.events.list'),
        {
          name: 'List custom server events',
          description: 'List all custom server events'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(customServerEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            version_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await customServerEventService.listCustomServerEvents({
          server: ctx.customServer,
          instance: ctx.instance,

          versionIds: normalizeArrayParam(ctx.query.version_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customServerEvent =>
          customServerEventPresenter.present({ customServerEvent })
        );
      }),

    get: customServerGroup
      .get(
        instancePath(
          'custom-servers/:customServerId/events/:customServerEventId',
          'custom_servers.events.get'
        ),
        {
          name: 'Get custom server event',
          description: 'Get information for a specific custom server event'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(customServerEventPresenter)
      .do(async ctx => {
        let customServerEvent = await customServerEventService.getCustomServerEventById({
          eventId: ctx.params.customServerEventId,
          instance: ctx.instance,
          server: ctx.customServer
        });

        return customServerEventPresenter.present({
          customServerEvent
        });
      })
  }
);
