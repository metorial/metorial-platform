import { serverService } from '@metorial/module-catalog';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverPresenter } from '../../presenters';

export let serverGroup = instanceGroup.use(async ctx => {
  let server = await serverService.getServerById({
    serverId: ctx.params.serverId,
    organization: ctx.organization
  });

  return { server };
});

export let serverController = Controller.create(
  {
    name: 'Server',
    description: 'Read and write server information'
  },
  {
    get: serverGroup
      .get(instancePath('servers/:serverId', 'servers.get'), {
        name: 'Get server',
        description: 'Get the information of a specific server'
      })
      .use(checkAccess({ possibleScopes: ['instance.server:read'] }))
      .output(serverPresenter)
      .do(async ctx => {
        return serverPresenter.present({ server: ctx.server });
      })
  }
);
