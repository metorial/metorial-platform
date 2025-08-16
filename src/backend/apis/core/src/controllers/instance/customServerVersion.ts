import { customServerVersionService } from '@metorial/module-custom-server';
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
    description: 'Manager custom server versions',
    hideInDocs: true
  },
  {
    list: customServerGroup
      .get(
        instancePath(
          'custom-servers/:customServerId/versions',
          'custom_servers.versions.list'
        ),
        {
          name: 'List custom server versions',
          description: 'List all custom server versions'
        }
      )
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
      .post(
        instancePath(
          'custom-servers/:customServerId/versions',
          'custom_servers.versions.create'
        ),
        {
          name: 'Create custom server version',
          description: 'Create a new custom server version'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          implementation: v.object({
            type: v.literal('remote_server'),

            remote_server: v.object({
              remote_url: v.string()
            }),

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
        let customServerVersion = await customServerVersionService.createVersion({
          organization: ctx.organization,
          instance: ctx.instance,
          server: ctx.customServer,
          performedBy: ctx.actor,
          serverInstance: {
            type: 'remote',
            implementation: {
              remoteUrl: ctx.body.implementation.remote_server.remote_url
            },
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
          'custom-servers/:customServerId/versions/:customServerVersionId',
          'custom_servers.versions.get'
        ),
        {
          name: 'Get custom server version',
          description: 'Get information for a specific custom server version'
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
