import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerAuthConfigService,
  providerAuthCredentialsService
} from '@metorial-subspace/module-auth';
import {
  providerToolService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import { providerToolPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantOptionalApp } from './tenant';

export let providerToolApp = tenantOptionalApp.use(async ctx => {
  let providerToolId = ctx.body.providerToolId;
  if (!providerToolId) throw new Error('ProviderTool ID is required');

  let providerTool = await providerToolService.getProviderToolById({
    providerToolId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerTool };
});

export let providerToolController = app.controller({
  list: tenantOptionalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string()),
          providerVersionId: v.string(),
          providerAuthConfigId: v.optional(v.string()),
          providerAuthCredentialsId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let providerVersion = await providerVersionService.getProviderVersionById({
        providerVersionId: ctx.input.providerVersionId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let providerAuthConfig =
        ctx.input.providerAuthConfigId && ctx.tenant && ctx.environment
          ? await providerAuthConfigService.getProviderAuthConfigById({
              tenant: ctx.tenant,
              environment: ctx.environment,
              solution: ctx.solution,
              providerAuthConfigId: ctx.input.providerAuthConfigId
            })
          : null;

      let providerAuthCredentials =
        ctx.input.providerAuthCredentialsId && ctx.tenant && ctx.environment
          ? await providerAuthCredentialsService.getProviderAuthCredentialsById({
              tenant: ctx.tenant,
              environment: ctx.environment,
              solution: ctx.solution,
              providerAuthCredentialsId: ctx.input.providerAuthCredentialsId
            })
          : null;

      let paginator = await providerToolService.listProviderTools({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        providerVersion,
        providerAuthConfig,
        providerAuthCredentials
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerToolPresenter);
    }),

  get: providerToolApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),

        providerToolId: v.string()
      })
    )
    .do(async ctx => providerToolPresenter(ctx.providerTool))
});
