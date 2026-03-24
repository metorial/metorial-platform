import { v } from '@lowerdeck/validation';
import {
  scmProviderSetupSessionPresenter,
  scmProviderSetupSessionService
} from '@metorial-subspace/module-custom-provider';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmProviderSetupSessionApp = tenantApp.use(async ctx => {
  let scmProviderSetupSessionId = ctx.body.scmProviderSetupSessionId;
  if (!scmProviderSetupSessionId) throw new Error('ScmProviderSetupSession ID is required');

  let scmProviderSetupSession =
    await scmProviderSetupSessionService.getScmProviderSetupSessionById({
      scmProviderSetupSessionId,
      tenant: ctx.tenant
    });

  return { scmProviderSetupSession };
});

export let scmProviderSetupSessionController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        type: v.enumOf(['github_enterprise', 'gitlab_selfhosted'])
      })
    )
    .do(async ctx => {
      let record = await scmProviderSetupSessionService.createScmProviderSetupSession({
        tenant: ctx.tenant,
        type: ctx.input.type
      });

      return scmProviderSetupSessionPresenter(record);
    }),

  get: scmProviderSetupSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmProviderSetupSessionId: v.string()
      })
    )
    .do(async ctx => scmProviderSetupSessionPresenter(ctx.scmProviderSetupSession))
});
