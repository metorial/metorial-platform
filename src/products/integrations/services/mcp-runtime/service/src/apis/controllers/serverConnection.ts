import { ServiceError, validationError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { InitializeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { serverConnectionPresenter } from '../../presenters';
import {
  serverAuthConfigService,
  serverConfigService,
  serverConnectionService,
  serverInstanceConfigurationService,
  serverVersionService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverConnectionApp = tenantApp.use(async ctx => {
  let serverConnectionId = ctx.body.serverConnectionId;
  if (!serverConnectionId) throw new Error('serverConnectionId is required');

  let serverConnection = await serverConnectionService.getServerConnectionById({
    tenant: ctx.tenant,
    serverConnectionId
  });

  return { serverConnection };
});

export let serverConnectionSyncApp = app.use(async ctx => {
  let serverConnectionId = ctx.body.serverConnectionId;
  if (!serverConnectionId) throw new Error('serverConnectionId is required');

  let serverConnection = await serverConnectionService.DANGEROUSLY_getServerConnectionById({
    serverConnectionId
  });

  return { serverConnection };
});

export let serverConnectionController = app.controller({
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
      let paginator = await serverConnectionService.listServerConnections({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverConnectionPresenter);
    }),

  listSync: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          serverConnectionIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverConnectionService.listServerConnectionsGlobal({
        serverConnectionIds: ctx.input.serverConnectionIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverConnectionPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        serverConfigId: v.string(),
        serverVersionId: v.string(),
        serverAuthConfigId: v.optional(v.string()),
        serverInstanceConfigurationId: v.optional(v.string()),

        client: v.record(v.any()),
        capabilities: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let schema = InitializeRequestSchema.safeParse({
        method: 'initialize',
        params: {
          ...ctx.input.client,
          protocolVersion: '1.0.0',
          capabilities: ctx.input.capabilities ?? {},
          clientInfo: ctx.input.client
        }
      });
      if (!schema.success) {
        throw new ServiceError(
          validationError({
            entity: 'input',
            errors: schema.error.issues.map(i => ({
              ...i,
              path: ['client', ...i.path.map(String)]
            }))
          })
        );
      }

      let serverConfig = await serverConfigService.getServerConfigById({
        tenant: ctx.tenant,
        serverConfigId: ctx.input.serverConfigId
      });
      let serverVersion = await serverVersionService.getServerVersionById({
        tenant: ctx.tenant,
        serverVersionId: ctx.input.serverVersionId
      });
      let serverAuthConfig = ctx.input.serverAuthConfigId
        ? await serverAuthConfigService.getServerAuthConfigById({
            tenant: ctx.tenant,
            serverAuthConfigId: ctx.input.serverAuthConfigId
          })
        : undefined;
      let serverInstanceConfiguration = ctx.input.serverInstanceConfigurationId
        ? await serverInstanceConfigurationService.getServerInstanceConfigurationById({
            tenant: ctx.tenant,
            serverInstanceConfigurationId: ctx.input.serverInstanceConfigurationId
          })
        : undefined;

      let res = await serverConnectionService.createServerConnection({
        tenant: ctx.tenant,
        input: {
          serverConfig,
          serverVersion,
          serverAuthConfig,
          serverInstanceConfiguration,

          client: schema.data.params.clientInfo,
          capabilities: schema.data.params.capabilities
        }
      });

      return serverConnectionPresenter(res);
    }),

  get: serverConnectionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverConnectionId: v.string()
      })
    )
    .do(async ctx => serverConnectionPresenter(ctx.serverConnection)),

  getSync: serverConnectionSyncApp
    .handler()
    .input(
      v.object({
        serverConnectionId: v.string()
      })
    )
    .do(async ctx => serverConnectionPresenter(ctx.serverConnection)),

  getLogs: serverConnectionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverConnectionId: v.string()
      })
    )
    .do(async ctx =>
      serverConnectionService.getLogs({
        serverConnection: ctx.serverConnection
      })
    ),

  getLogsSync: serverConnectionSyncApp
    .handler()
    .input(
      v.object({
        serverConnectionId: v.string()
      })
    )
    .do(async ctx =>
      serverConnectionService.getLogs({
        serverConnection: ctx.serverConnection
      })
    )
});
