import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { serverOAuthSetupLogsPresenter, serverOAuthSetupPresenter } from '../../presenters';
import {
  serverOAuthCredentialsService,
  serverOAuthSetupService,
  serverInstanceConfigurationService,
  serverService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let serverOAuthSetupApp = tenantApp.use(async ctx => {
  let serverOAuthSetupId = ctx.body.serverOAuthSetupId;
  if (!serverOAuthSetupId) throw new Error('serverOAuthSetupId is required');

  let serverOAuthSetup = await serverOAuthSetupService.getServerOAuthSetupById({
    tenant: ctx.tenant,
    serverOAuthSetupId
  });

  return { serverOAuthSetup };
});

export let serverOAuthSetupSyncApp = app.use(async ctx => {
  let serverOAuthSetupId = ctx.body.serverOAuthSetupId;
  if (!serverOAuthSetupId) throw new Error('serverOAuthSetupId is required');

  let serverOAuthSetup = await serverOAuthSetupService.DANGEROUSLY_getServerOAuthSetupById({
    serverOAuthSetupId
  });

  return { serverOAuthSetup };
});

export let serverOAuthSetupController = app.controller({
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
      let paginator = await serverOAuthSetupService.listServerOAuthSetups({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverOAuthSetupPresenter);
    }),

  listSync: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          serverOAuthSetupIds: v.optional(v.array(v.string())),
          serverIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(v.enumOf(['pending', 'completed', 'failed'])))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverOAuthSetupService.listServerOAuthSetupsGlobal({
        serverOAuthSetupIds: ctx.input.serverOAuthSetupIds,
        serverIds: ctx.input.serverIds,
        statuses: ctx.input.statuses
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverOAuthSetupPresenter);
    }),

  listIncomplete: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          serverOAuthSetupIds: v.optional(v.array(v.string())),
          serverIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await serverOAuthSetupService.listServerOAuthSetupsGlobal({
        serverOAuthSetupIds: ctx.input.serverOAuthSetupIds,
        serverIds: ctx.input.serverIds,
        statuses: ['pending']
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, serverOAuthSetupPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        serverCredentialsId: v.optional(v.string()),
        serverInstanceConfigurationId: v.optional(v.string()),
        serverId: v.string(),
        redirectUrl: v.string(),
        callbackUrlOverride: v.optional(v.string()),

        input: v.optional(v.object({}))
      })
    )
    .do(async ctx => {
      let server = await serverService.getServerById({
        tenant: ctx.tenant,
        serverId: ctx.input.serverId
      });
      let credentials = ctx.input.serverCredentialsId
        ? await serverOAuthCredentialsService.getServerOAuthCredentialsById({
            tenant: ctx.tenant,
            serverOAuthCredentialsId: ctx.input.serverCredentialsId
          })
        : undefined;
      let serverInstanceConfiguration = ctx.input.serverInstanceConfigurationId
        ? await serverInstanceConfigurationService.getServerInstanceConfigurationById({
            tenant: ctx.tenant,
            serverInstanceConfigurationId: ctx.input.serverInstanceConfigurationId
          })
        : undefined;

      let res = await serverOAuthSetupService.createServerOAuthSetup({
        tenant: ctx.tenant,
        input: {
          server,
          credentials,
          serverInstanceConfiguration,
          authConfig: ctx.input.input,
          redirectUrl: ctx.input.redirectUrl,
          callbackUrlOverride: ctx.input.callbackUrlOverride
        }
      });

      return serverOAuthSetupPresenter(res);
    }),

  get: serverOAuthSetupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverOAuthSetupId: v.string()
      })
    )
    .do(async ctx => serverOAuthSetupPresenter(ctx.serverOAuthSetup)),

  getSync: serverOAuthSetupSyncApp
    .handler()
    .input(
      v.object({
        serverOAuthSetupId: v.string()
      })
    )
    .do(async ctx => serverOAuthSetupPresenter(ctx.serverOAuthSetup)),

  getLogs: serverOAuthSetupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverOAuthSetupId: v.string()
      })
    )
    .do(async ctx =>
      serverOAuthSetupLogsPresenter(
        await serverOAuthSetupService.getServerOAuthSetupLogs({
          tenant: ctx.tenant,
          serverOAuthSetupId: ctx.serverOAuthSetup.id
        })
      )
    ),

  getLogsSync: serverOAuthSetupSyncApp
    .handler()
    .input(
      v.object({
        serverOAuthSetupId: v.string()
      })
    )
    .do(async ctx =>
      serverOAuthSetupLogsPresenter(
        await serverOAuthSetupService.getServerOAuthSetupLogs({
          serverOAuthSetupId: ctx.serverOAuthSetup.id
        })
      )
    )
});
