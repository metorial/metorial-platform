import { serverService } from '@metorial/module-catalog';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverPresenter } from '../../presenters';

export let serverGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverId) throw new Error('serverId is required');

  let server = await serverService.getServerById({
    serverId: ctx.params.serverId,
    organization: ctx.organization
  });

  return { server };
});

export let serverController = Controller.create(
  {
    name: 'Servers',
    description: `A server represents a deployable MCP server in Metorial\'s catalog. You can use server deployments to create MCP server instances that you can connect to.`
  },
  {
    get: serverGroup
      .get(instancePath('servers/:serverId', 'servers.get'), {
        name: 'Get server by ID',
        description: 'Retrieves detailed information for a server identified by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.server:read'] }))
      .output(serverPresenter)
      .do(async ctx => {
        return serverPresenter.present({
          server: ctx.server
        });
      })
  }
);
