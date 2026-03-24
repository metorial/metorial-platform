import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  customProviderCommitService,
  customProviderEnvironmentService,
  customProviderVersionService
} from '@metorial-subspace/module-custom-provider';
import { actorService } from '@metorial-subspace/module-tenant';
import { customProviderCommitPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let customProviderCommitApp = tenantApp.use(async ctx => {
  let customProviderCommitId = ctx.body.customProviderCommitId;
  if (!customProviderCommitId) throw new Error('CustomProviderCommit ID is required');

  let customProviderCommit = await customProviderCommitService.getCustomProviderCommitById({
    customProviderCommitId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution
  });

  return { customProviderCommit };
});

export let customProviderCommitController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          customProviderIds: v.optional(v.array(v.string())),
          customProviderVersionIds: v.optional(v.array(v.string())),
          customProviderEnvironmentIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await customProviderCommitService.listCustomProviderCommits({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        providerIds: ctx.input.providerIds,
        customProviderIds: ctx.input.customProviderIds,
        customProviderVersionIds: ctx.input.customProviderVersionIds,
        customProviderEnvironmentIds: ctx.input.customProviderEnvironmentIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, customProviderCommitPresenter);
    }),

  get: customProviderCommitApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        customProviderCommitId: v.string()
      })
    )
    .do(async ctx => customProviderCommitPresenter(ctx.customProviderCommit)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.string(),

        message: v.string(),

        action: v.union([
          v.object({
            type: v.literal('merge_version_into_environment'),
            fromEnvironmentId: v.string(),
            toEnvironmentId: v.string()
          }),
          v.object({
            type: v.literal('rollback_commit'),
            environmentId: v.string(),
            versionId: v.string()
          })
        ])
      })
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      let customProviderCommit = await customProviderCommitService.createCustomProviderCommit({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        actor,

        input: {
          message: ctx.input.message,

          action:
            ctx.input.action.type === 'merge_version_into_environment'
              ? {
                  type: 'merge_version_into_environment' as const,
                  fromEnvironment:
                    await customProviderEnvironmentService.getCustomProviderEnvironmentById({
                      tenant: ctx.tenant,
                      environment: ctx.environment,
                      solution: ctx.solution,
                      customProviderEnvironmentId: ctx.input.action.fromEnvironmentId
                    }),
                  toEnvironment:
                    await customProviderEnvironmentService.getCustomProviderEnvironmentById({
                      tenant: ctx.tenant,
                      environment: ctx.environment,
                      solution: ctx.solution,
                      customProviderEnvironmentId: ctx.input.action.toEnvironmentId
                    })
                }
              : {
                  type: 'rollback_to_version' as const,
                  environment:
                    await customProviderEnvironmentService.getCustomProviderEnvironmentById({
                      tenant: ctx.tenant,
                      environment: ctx.environment,
                      solution: ctx.solution,
                      customProviderEnvironmentId: ctx.input.action.environmentId
                    }),
                  version: await customProviderVersionService.getCustomProviderVersionById({
                    tenant: ctx.tenant,
                    environment: ctx.environment,
                    solution: ctx.solution,
                    customProviderVersionId: ctx.input.action.versionId
                  })
                }
        }
      });

      return customProviderCommitPresenter(customProviderCommit);
    })
});
