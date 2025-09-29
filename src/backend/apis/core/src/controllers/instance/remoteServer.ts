import { remoteServerService } from '@metorial/module-custom-server';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { remoteServerPresenter } from '../../presenters';

export let remoteServerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.remoteServerId) throw new Error('remoteServerId is required');

  let remoteServer = await remoteServerService.getRemoteServerById({
    serverId: ctx.params.remoteServerId,
    instance: ctx.instance
  });

  return { remoteServer };
});

export let remoteServerController = Controller.create(
  {
    name: 'Remote Server',
    description: 'Manager remote servers',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(
        instancePath('custom-servers/remote-servers', 'custom_servers.remote_servers.list'),
        {
          name: 'List remote servers',
          description: 'List all remote servers'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(remoteServerPresenter)
      .query('default', Paginator.validate(v.object({})))
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        let paginator = await remoteServerService.listRemoteServers({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, remoteServerInstance =>
          remoteServerPresenter.present({ remoteServerInstance })
        );
      }),

    get: remoteServerGroup
      .get(
        instancePath(
          'custom-servers/remote-servers/:remoteServerId',
          'custom_servers.remote_servers.get'
        ),
        {
          name: 'Get remote server',
          description: 'Get information for a specific remote server'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(remoteServerPresenter)
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        return remoteServerPresenter.present({
          remoteServerInstance: ctx.remoteServer
        });
      })
  }
);
