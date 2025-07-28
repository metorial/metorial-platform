import { customServerVersionService } from '@metorial/module-custom-server';
import { remoteServerService } from '@metorial/module-remote-server';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { customServerVersionPresenter } from '../../presenters';
import { customServerGroup } from './customServer';

export let customServerVersionController = Controller.create(
  {
    name: 'Custom Server',
    description: 'Manager custom servers',
    hideInDocs: true
  },
  {
    list: customServerGroup
      .get(instancePath('custom-servers/custom-server', 'custom_servers.versions.list'), {
        name: 'List custom servers',
        description: 'List all custom servers'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(customServerVersionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await customServerVersionService.listVersions({
          server: ctx.customServer,
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customServerVersion =>
          customServerVersionPresenter.present({ customServerVersion })
        );
      }),

    create: customServerGroup
      .post(instancePath('custom-servers/custom-server', 'custom_servers.versions.create'), {
        name: 'Create custom server',
        description: 'Create a new custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          implementation: v.object({
            type: v.literal('remote_server'),
            remote_server_id: v.string(),

            config: v.optional(
              v.object({
                schema: v.optional(v.any()),
                getLaunchParams: v.optional(v.string())
              })
            )
          })
        })
      )
      .output(customServerVersionPresenter)
      .do(async ctx => {
        let remoteServer = await remoteServerService.getRemoteServerById({
          serverId: ctx.body.implementation.remote_server_id,
          instance: ctx.instance
        });

        let customServerVersion = await customServerVersionService.createVersion({
          organization: ctx.organization,
          instance: ctx.instance,
          server: ctx.customServer,
          serverInstance: {
            type: 'remote',
            implementation: remoteServer,
            config: {
              schema: ctx.body.implementation.config?.schema,
              getLaunchParams: ctx.body.implementation.config?.getLaunchParams
            }
          }
        });

        return customServerVersionPresenter.present({ customServerVersion });
      }),

    get: customServerGroup
      .get(
        instancePath(
          'custom-servers/custom-server/:customServerVersionId',
          'custom_servers.versions.get'
        ),
        {
          name: 'Get custom server',
          description: 'Get information for a specific custom server'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(customServerVersionPresenter)
      .do(async ctx => {
        let customServerVersion = await customServerVersionService.getVersionById({
          versionId: ctx.params.customServerVersionId,
          instance: ctx.instance,
          server: ctx.customServer
        });

        return customServerVersionPresenter.present({
          customServerVersion
        });
      })
  }
);
