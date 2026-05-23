import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { serverDeploymentPresenter, serverPresenter } from '../../presenters';
import { serverService } from '../../services';
import { app } from './_app';
import { tenantApp, tenantOptionalApp } from './tenant';

export let serverApp = tenantApp.use(async ctx => {
  let serverId = ctx.body.serverId;
  if (!serverId) throw new Error('serverId is required');

  let server = await serverService.getServerById({
    tenant: ctx.tenant,
    serverId
  });

  return { server };
});

export let serverController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverService.listServers({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverPresenter);
    }),

  create: tenantOptionalApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),

        from: v.union([
          v.object({
            type: v.literal('container.from_image_ref'),
            imageRef: v.string(),
            username: v.optional(v.string()),
            password: v.optional(v.string())
          }),
          v.object({
            type: v.literal('remote'),
            remoteUrl: v.string(),
            config: v.optional(v.record(v.any())),
            protocol: v.enumOf(['sse', 'streamable_http'])
          }),
          v.object({
            type: v.literal('function'),
            files: v.array(
              v.object({
                filename: v.string(),
                content: v.string(),
                encoding: v.optional(v.enumOf(['utf-8', 'base64']))
              })
            ),
            env: v.record(v.string()),
            runtime: v.union([
              v.object({
                identifier: v.literal('nodejs'),
                version: v.enumOf(['24.x', '22.x'])
              }),
              v.object({
                identifier: v.literal('python'),
                version: v.enumOf(['3.14', '3.13', '3.12'])
              })
            ])
          })
        ]),

        config: v.optional(
          v.object({
            schema: v.record(v.any()),
            transformer: v.string()
          })
        ),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let res = await serverService.createServer({
        scope: ctx.tenant ? { type: 'tenant', tenant: ctx.tenant } : { type: 'global' },

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,

          config: ctx.input.config,
          from: ctx.input.from
        }
      });

      return {
        server: serverPresenter(res.server),
        deployment: serverDeploymentPresenter(res.deployment)
      };
    }),

  createVersion: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverId: v.string(),

        from: v.union([
          v.object({
            type: v.literal('container.from_image_ref'),
            imageRef: v.string(),
            username: v.optional(v.string()),
            password: v.optional(v.string())
          }),
          v.object({
            type: v.literal('remote'),
            remoteUrl: v.string(),
            protocol: v.enumOf(['sse', 'streamable_http'])
          }),
          v.object({
            type: v.literal('function'),
            files: v.array(
              v.object({
                filename: v.string(),
                content: v.string(),
                encoding: v.optional(v.enumOf(['utf-8', 'base64']))
              })
            ),
            env: v.record(v.string()),
            runtime: v.union([
              v.object({
                identifier: v.literal('nodejs'),
                version: v.enumOf(['24.x', '22.x'])
              }),
              v.object({
                identifier: v.literal('python'),
                version: v.enumOf(['3.14', '3.13', '3.12'])
              })
            ])
          })
        ]),

        config: v.optional(
          v.object({
            schema: v.record(v.any()),
            transformer: v.string()
          })
        )
      })
    )
    .do(async ctx => {
      let server = await serverService.getServerById({
        tenant: ctx.tenant,
        serverId: ctx.input.serverId
      });

      let res = await serverService.createServerVersion({
        tenant: ctx.tenant,
        server,

        input: {
          config: ctx.input.config,
          from: ctx.input.from
        }
      });

      return serverDeploymentPresenter(res);
    }),

  get: serverApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverId: v.string()
      })
    )
    .do(async ctx => serverPresenter(ctx.server)),

  getMany: tenantOptionalApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        serverIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let servers = await serverService.getManyServersByIds({
        tenant: ctx.tenant,
        serverIds: ctx.input.serverIds
      });

      return servers.map(serverPresenter);
    }),

  update: serverApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let updatedServer = await serverService.updateServer({
        server: ctx.server,
        tenant: ctx.tenant,

        input: {
          name: ctx.input.name,
          description: ctx.input.description
        }
      });

      return serverPresenter(updatedServer);
    })
});
