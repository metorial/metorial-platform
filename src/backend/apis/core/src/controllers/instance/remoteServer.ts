import { providerOauthConnectionService } from '@metorial/module-provider-oauth';
import { remoteServerService } from '@metorial/module-remote-server';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
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
        instancePath('custom-servers/remote-server', 'custom_servers.remote_servers.list'),
        {
          name: 'List remote servers',
          description: 'List all remote servers'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(remoteServerPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await remoteServerService.listRemoteServers({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, remoteServerInstance =>
          remoteServerPresenter.present({ remoteServerInstance })
        );
      }),

    create: instanceGroup
      .post(
        instancePath('custom-servers/remote-server', 'custom_servers.remote_servers.create'),
        {
          name: 'Create remote server',
          description: 'Create a new remote server'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          connection_id: v.optional(v.string()),
          remote_url: v.string()
        })
      )
      .output(remoteServerPresenter)
      .do(async ctx => {
        let connection = ctx.body.connection_id
          ? await providerOauthConnectionService.getConnectionById({
              connectionId: ctx.body.connection_id,
              instance: ctx.instance
            })
          : undefined;

        let remoteServerInstance = await remoteServerService.createRemoteServer({
          organization: ctx.organization,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            remoteUrl: ctx.body.remote_url,
            connection
          }
        });

        return remoteServerPresenter.present({ remoteServerInstance });
      }),

    get: remoteServerGroup
      .get(
        instancePath(
          'custom-servers/remote-server/:remoteServerId',
          'custom_servers.remote_servers.get'
        ),
        {
          name: 'Get remote server',
          description: 'Get information for a specific remote server'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(remoteServerPresenter)
      .do(async ctx => {
        return remoteServerPresenter.present({
          remoteServerInstance: ctx.remoteServer
        });
      })
  }
);
