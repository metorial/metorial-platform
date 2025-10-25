import { serverConfigVaultService } from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverConfigVaultPresenter } from '../../presenters';

export let serverConfigVaultGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.serverConfigVaultId) throw new Error('serverConfigVaultId is required');

  let serverConfigVault = await serverConfigVaultService.getServerConfigVaultById({
    serverConfigVaultId: ctx.params.serverConfigVaultId,
    instance: ctx.instance
  });

  return { serverConfigVault };
});

export let serverConfigVaultController = Controller.create(
  {
    name: 'Server Config Vault',
    description: 'Store reusable configuration data for MCP servers in a secure vault.'
  },
  {
    list: instanceGroup
      .get(instancePath('server-config-vault', 'serverConfigVaults.list'), {
        name: 'List server runs',
        description: 'List all server runs'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.config_vault:read'] }))
      .outputList(serverConfigVaultPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await serverConfigVaultService.listServerConfigVaults({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverConfigVault =>
          serverConfigVaultPresenter.present({ serverConfigVault })
        );
      }),

    get: serverConfigVaultGroup
      .get(
        instancePath('server-config-vault/:serverConfigVaultId', 'serverConfigVaults.get'),
        {
          name: 'Get server run',
          description: 'Get the information of a specific server run'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.config_vault:read'] }))
      .output(serverConfigVaultPresenter)
      .do(async ctx => {
        return serverConfigVaultPresenter.present({
          serverConfigVault: ctx.serverConfigVault
        });
      }),

    create: instanceGroup
      .post(instancePath('server-config-vault', 'serverConfigVaults.create'), {
        name: 'Create server config vault',
        description: 'Create a new server config vault'
      })
      .use(checkAccess({ possibleScopes: ['instance.server.config_vault:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          config: v.record(v.any())
        })
      )
      .output(serverConfigVaultPresenter)
      .do(async ctx => {
        let serverConfigVault = await serverConfigVaultService.createServerConfigVault({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            config: ctx.body.config
          }
        });

        return serverConfigVaultPresenter.present({ serverConfigVault });
      }),

    update: serverConfigVaultGroup
      .patch(
        instancePath('server-config-vault/:serverConfigVaultId', 'serverConfigVaults.update'),
        {
          name: 'Update server config vault',
          description: 'Update an existing server config vault'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.server.config_vault:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(serverConfigVaultPresenter)
      .do(async ctx => {
        let serverConfigVault = await serverConfigVaultService.updateServerConfigVault({
          instance: ctx.instance,
          serverConfigVault: ctx.serverConfigVault,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return serverConfigVaultPresenter.present({ serverConfigVault });
      })
  }
);
