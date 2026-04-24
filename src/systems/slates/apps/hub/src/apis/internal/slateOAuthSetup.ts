import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateInstanceOAuthSetupPresenter } from '../../presenters';
import { slateInstanceOAuthSetupLogsPresenter } from '../../presenters/slateOAuthSetupLogs';
import {
  slateOAuthCredentialsService,
  slateOAuthSetupService,
  slateService,
  slateVersionService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateOAuthSetupApp = tenantApp.use(async ctx => {
  let slateOAuthSetupId = ctx.body.slateOAuthSetupId;
  if (!slateOAuthSetupId) throw new Error('Slate OAuthSetup ID is required');

  let slateOAuthSetup = await slateOAuthSetupService.getSlateInstanceOAuthSetupById({
    id: slateOAuthSetupId,
    tenant: ctx.tenant
  });

  return { slateOAuthSetup };
});

export let slateOAuthSetupSyncApp = app.use(async ctx => {
  let slateOAuthSetupId = ctx.body.slateOAuthSetupId;
  if (!slateOAuthSetupId) throw new Error('Slate OAuthSetup ID is required');

  let slateOAuthSetup =
    await slateOAuthSetupService.DANGEROUSLY_getSlateInstanceOAuthSetupById({
      id: slateOAuthSetupId
    });

  return { slateOAuthSetup };
});

export let slateOAuthSetupController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateOAuthSetupService.listSlateInstanceOAuthSetups({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateInstanceOAuthSetupPresenter);
    }),

  listIncomplete: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateOAuthSetupIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateOAuthSetupService.listIncompleteSlateInstanceOAuthSetups({
        slateOAuthSetupIds: ctx.input.slateOAuthSetupIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateInstanceOAuthSetupPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateId: v.string(),
          slateOAuthCredentialsId: v.string(),
          slateVersionId: v.optional(v.string()),
          authMethodId: v.optional(v.string()),
          redirectUrl: v.string(),
          input: v.record(v.any()),
          callbackUrlOverride: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({
        id: ctx.input.slateId
      });
      let oauthCredentials = await slateOAuthCredentialsService.getSlateOAuthCredentialsById({
        id: ctx.input.slateOAuthCredentialsId,
        tenant: ctx.tenant
      });
      let slateVersion = ctx.input.slateVersionId
        ? await slateVersionService.getSlateVersionById({
            id: ctx.input.slateVersionId,
            slate
          })
        : undefined;

      let res = await slateOAuthSetupService.createSlateInstanceOAuthSetup({
        tenant: ctx.tenant,

        input: {
          slate,
          slateVersion,
          oauthCredentials,

          redirectUrl: ctx.input.redirectUrl,
          authMethodId: ctx.input.authMethodId,

          input: ctx.input.input,

          callbackUrlOverride: ctx.input.callbackUrlOverride
        }
      });

      return slateInstanceOAuthSetupPresenter(res);
    }),

  get: slateOAuthSetupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateOAuthSetupId: v.string()
      })
    )
    .do(async ctx => slateInstanceOAuthSetupPresenter(ctx.slateOAuthSetup)),

  getLogs: slateOAuthSetupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateOAuthSetupId: v.string()
      })
    )
    .do(async ctx => {
      let logs = await slateOAuthSetupService.getSlateInstanceOAuthSetupLogs({
        setup: ctx.slateOAuthSetup
      });

      return await slateInstanceOAuthSetupLogsPresenter(logs);
    }),

  getLogsSync: slateOAuthSetupSyncApp
    .handler()
    .input(
      v.object({
        slateOAuthSetupId: v.string()
      })
    )
    .do(async ctx => {
      let logs = await slateOAuthSetupService.getSlateInstanceOAuthSetupLogs({
        setup: ctx.slateOAuthSetup
      });

      return await slateInstanceOAuthSetupLogsPresenter(logs);
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateOAuthSetupIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateOAuthSetups = await slateOAuthSetupService.getManySlateInstanceOAuthSetupsByIds(
        {
          ids: ctx.input.slateOAuthSetupIds,
          tenant: ctx.tenant
        }
      );

      return slateOAuthSetups.map(slateInstanceOAuthSetupPresenter);
    })
});
