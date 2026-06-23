import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { identityDelegationConfigService } from '@metorial-subspace/module-identity';
import { identityDelegationConfigPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let identityDelegationConfigApp = tenantApp.use(async ctx => {
  let identityDelegationConfigId = ctx.body.identityDelegationConfigId;
  if (!identityDelegationConfigId) {
    throw new Error('IdentityDelegationConfig ID is required');
  }

  let identityDelegationConfig =
    await identityDelegationConfigService.getIdentityDelegationConfigById({
      identityDelegationConfigId,
      tenant: ctx.tenant,
      environment: ctx.environment,
      solution: ctx.solution,
      allowDeleted: ctx.body.allowDeleted
    });

  return { identityDelegationConfig };
});

export let identityDelegationConfigController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await identityDelegationConfigService.listIdentityDelegationConfigs({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        search: ctx.input.search,

        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, identityDelegationConfigPresenter);
    }),

  get: identityDelegationConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationConfigId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => identityDelegationConfigPresenter(ctx.identityDelegationConfig)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        subDelegationBehavior: v.enumOf(['allow', 'deny', 'require_consent']),
        subDelegationDepth: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let identityDelegationConfig =
        await identityDelegationConfigService.createIdentityDelegationConfig({
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,

          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,
            subDelegationBehavior: ctx.input.subDelegationBehavior,
            subDelegationDepth: ctx.input.subDelegationDepth
          }
        });

      return identityDelegationConfigPresenter(identityDelegationConfig);
    }),

  update: identityDelegationConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationConfigId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),

        subDelegationBehavior: v.optional(v.enumOf(['allow', 'deny', 'require_consent'])),
        subDelegationDepth: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let identityDelegationConfig =
        await identityDelegationConfigService.updateIdentityDelegationConfig({
          identityDelegationConfig: ctx.identityDelegationConfig,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution,

          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            metadata: ctx.input.metadata,

            subDelegationBehavior: ctx.input.subDelegationBehavior,
            subDelegationDepth: ctx.input.subDelegationDepth
          }
        });

      return identityDelegationConfigPresenter(identityDelegationConfig);
    }),

  delete: identityDelegationConfigApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        identityDelegationConfigId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let identityDelegationConfig =
        await identityDelegationConfigService.archiveIdentityDelegationConfig({
          identityDelegationConfig: ctx.identityDelegationConfig,
          tenant: ctx.tenant,
          environment: ctx.environment,
          solution: ctx.solution
        });

      return identityDelegationConfigPresenter(identityDelegationConfig);
    })
});
