import { remoteServerNotificationService } from '@metorial/module-remote-server';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { remoteServerNotificationPresenter } from '../../presenters';
import { remoteServerGroup } from './remoteServer';

export let remoteServerNotificationController = Controller.create(
  {
    name: 'Remote Server Notification',
    description: 'Manager remote server notifications',
    hideInDocs: true
  },
  {
    list: remoteServerGroup
      .get(
        instancePath(
          'custom-servers/remote-servers/:remoteServerId/notifications',
          'custom_servers.remote_servers.notifications.list'
        ),
        {
          name: 'List remote server notifications',
          description: 'List all remote server notifications'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(remoteServerNotificationPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await remoteServerNotificationService.listRemoteServerNotifications({
          server: ctx.remoteServer
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, remoteServerInstanceNotification =>
          remoteServerNotificationPresenter.present({ remoteServerInstanceNotification })
        );
      }),

    get: remoteServerGroup
      .get(
        instancePath(
          'custom-servers/remote-servers/:remoteServerId/notifications/:remoteServerNotificationId',
          'custom_servers.remote_servers.notifications.get'
        ),
        {
          name: 'Get remote server notification',
          description: 'Get information for a specific remote server notification'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(remoteServerNotificationPresenter)
      .do(async ctx => {
        let notification =
          await remoteServerNotificationService.getRemoteServerNotificationById({
            server: ctx.remoteServer,
            notificationId: ctx.params.remoteServerNotificationId
          });

        return remoteServerNotificationPresenter.present({
          remoteServerInstanceNotification: notification
        });
      })
  }
);
