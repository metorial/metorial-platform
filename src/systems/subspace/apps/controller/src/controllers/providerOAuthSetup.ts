import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerAuthCredentialsService,
  providerOAuthSetupService
} from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { providerOAuthSetupPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let providerOAuthSetupApp = tenantApp.use(async ctx => {
  let providerOAuthSetupId = ctx.body.providerOAuthSetupId;
  if (!providerOAuthSetupId) throw new Error('ProviderOAuthSetup ID is required');

  let providerOAuthSetup = await providerOAuthSetupService.getProviderOAuthSetupById({
    providerOAuthSetupId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { providerOAuthSetup };
});

export let providerOAuthSetupController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await providerOAuthSetupService.listProviderOAuthSetups({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, providerOAuthSetupPresenter);
    }),

  get: providerOAuthSetupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerOAuthSetupId: v.string()
      })
    )
    .do(async ctx => providerOAuthSetupPresenter(ctx.providerOAuthSetup)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        redirectUrl: v.optional(v.string()),

        isEphemeral: v.optional(v.boolean()),

        providerId: v.string(),
        providerAuthCredentialsId: v.optional(v.string()),
        providerDeploymentId: v.optional(v.string()),
        providerAuthMethodId: v.optional(v.string()),

        config: v.record(v.any())
      })
    )
    .do(async ctx => {
      let provider = await providerService.getProviderById({
        providerId: ctx.input.providerId,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution
      });

      let credentials = ctx.input.providerAuthCredentialsId
        ? await providerAuthCredentialsService.getProviderAuthCredentialsById({
            providerAuthCredentialsId: ctx.input.providerAuthCredentialsId,
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution
          })
        : undefined;

      let providerDeployment = ctx.input.providerDeploymentId
        ? await providerDeploymentService.getProviderDeploymentById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            solution: ctx.solution,
            providerDeploymentId: ctx.input.providerDeploymentId
          })
        : undefined;

      let providerOAuthSetup = await providerOAuthSetupService.createProviderOAuthSetup({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        provider,
        providerDeployment,
        credentials,

        input: {
          authMethodId: ctx.input.providerAuthMethodId,

          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          isEphemeral: ctx.input.isEphemeral,

          config: ctx.input.config
        }
      });

      return providerOAuthSetupPresenter(providerOAuthSetup);
    }),

  update: providerOAuthSetupApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        providerOAuthSetupId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let providerOAuthSetup = await providerOAuthSetupService.updateProviderOAuthSetup({
        providerOAuthSetup: ctx.providerOAuthSetup,
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata
        }
      });

      return providerOAuthSetupPresenter(providerOAuthSetup);
    })
});
