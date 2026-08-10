import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  scmAccountPreviewPresenter,
  scmRepositoryPreviewPresenter,
  scmRepositoryService
} from '@metorial-subspace/module-custom-provider';
import { scmRepositoryPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let scmRepositoryApp = tenantApp.use(async ctx => {
  let scmRepositoryId = ctx.body.scmRepositoryId;
  if (!scmRepositoryId) throw new Error('ScmRepository ID is required');

  let scmRepository = await scmRepositoryService.getScmRepositoryById({
    scmRepositoryId,
    tenant: ctx.tenant,
    solution: ctx.solution,
    environment: ctx.environment
  });

  return { scmRepository };
});

export let scmRepositoryController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          customProviderIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await scmRepositoryService.listScmRepositories({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        customProviderIds: ctx.input.customProviderIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, scmRepositoryPresenter);
    }),

  get: scmRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmRepositoryId: v.string()
      })
    )
    .do(async ctx => scmRepositoryPresenter(ctx.scmRepository)),

  listAccountPreviews: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmConnectionId: v.string()
      })
    )
    .do(async ctx => {
      let items = await scmRepositoryService.listScmAccountPreviews({
        tenant: ctx.tenant,
        input: {
          scmConnectionId: ctx.input.scmConnectionId
        }
      });

      return items.accounts.map(item => scmAccountPreviewPresenter(item));
    }),

  listRepositoryPreviews: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmConnectionId: v.string(),
        externalAccountId: v.optional(v.string()),
        cursor: v.optional(v.string()),
        limit: v.optional(
          v.number({
            modifiers: [v.minValue(1), v.maxValue(100)]
          })
        )
      })
    )
    .do(async ctx => {
      let items = await scmRepositoryService.listScmRepositoryPreviews({
        tenant: ctx.tenant,
        input: {
          scmConnectionId: ctx.input.scmConnectionId,
          externalAccountId: ctx.input.externalAccountId,
          cursor: ctx.input.cursor,
          limit: ctx.input.limit
        }
      });

      return {
        repositories: items.repositories.map(item => scmRepositoryPreviewPresenter(item)),
        nextCursor: items.nextCursor
      };
    }),

  createRepository: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        scmConnectionId: v.string(),
        externalAccountId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        isPrivate: v.boolean()
      })
    )
    .do(async ctx => {
      let res = await scmRepositoryService.createScmRepository({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,

        input: {
          scmConnectionId: ctx.input.scmConnectionId,
          externalAccountId: ctx.input.externalAccountId,
          name: ctx.input.name,
          description: ctx.input.description,
          isPrivate: ctx.input.isPrivate
        }
      });

      return scmRepositoryPresenter(res);
    }),

  linkRepository: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        scmConnectionId: v.string(),
        externalId: v.string()
      })
    )
    .do(async ctx => {
      let res = await scmRepositoryService.linkScmRepository({
        tenant: ctx.tenant,
        solution: ctx.solution,
        environment: ctx.environment,

        input: {
          scmConnectionId: ctx.input.scmConnectionId,
          externalId: ctx.input.externalId
        }
      });

      return scmRepositoryPresenter(res);
    })
});
