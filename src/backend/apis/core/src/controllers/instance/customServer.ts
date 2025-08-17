import { customServerService } from '@metorial/module-custom-server';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { customServerPresenter } from '../../presenters';

export let customServerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customServerId) throw new Error('customServerId is required');

  let customServer = await customServerService.getCustomServerById({
    serverId: ctx.params.customServerId,
    organization: ctx.organization
  });

  return { customServer };
});

let customServerTypeEnum = v.enumOf(['remote']);

export let customServerController = Controller.create(
  {
    name: 'Custom Server',
    description: 'Manager custom servers',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('custom-servers', 'custom_servers.list'), {
        name: 'List custom servers',
        description: 'List all custom servers'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(customServerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            type: v.optional(v.union([v.array(customServerTypeEnum), customServerTypeEnum]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await customServerService.listCustomServers({
          organization: ctx.organization,
          types: normalizeArrayParam(ctx.query.type)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customServer =>
          customServerPresenter.present({ customServer })
        );
      }),

    create: instanceGroup
      .post(instancePath('custom-servers', 'custom_servers.create'), {
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
            type: v.literal('remote'),

            remote_server: v.object({
              remote_url: v.string({ modifiers: [v.url()] })
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
      .output(customServerPresenter)
      .do(async ctx => {
        let customServer = await customServerService.createCustomServer({
          organization: ctx.organization,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          },
          isEphemeral: false,
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

        return customServerPresenter.present({ customServer });
      }),

    update: customServerGroup
      .patch(instancePath('custom-servers/:customServerId', 'custom_servers.update'), {
        name: 'Update custom server',
        description: 'Update a custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(customServerPresenter)
      .do(async ctx => {
        let customServer = await customServerService.updateCustomServer({
          server: ctx.customServer,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return customServerPresenter.present({ customServer });
      }),

    delete: customServerGroup
      .delete(instancePath('custom-servers/:customServerId', 'custom_servers.delete'), {
        name: 'Delete custom server',
        description: 'Delete a custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:write'] }))
      .output(customServerPresenter)
      .do(async ctx => {
        let customServer = await customServerService.deleteCustomServer({
          server: ctx.customServer
        });

        return customServerPresenter.present({ customServer });
      }),

    get: customServerGroup
      .get(instancePath('custom-servers/:customServerId', 'custom_servers.get'), {
        name: 'Get custom server',
        description: 'Get information for a specific custom server'
      })
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(customServerPresenter)
      .do(async ctx => {
        return customServerPresenter.present({
          customServer: ctx.customServer
        });
      })
  }
);
