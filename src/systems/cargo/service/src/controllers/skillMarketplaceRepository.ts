import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { skillMarketplaceRepositoryService } from '@metorial-cargo/module-skill';
import { skillMarketplaceRepositoryPresenter } from '../presenters';
import { app } from './_app';
import { skillMarketplaceApp } from './skillMarketplace';

export let skillMarketplaceRepositoryController = app.controller({
  list: skillMarketplaceApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillMarketplaceId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillMarketplaceRepositoryService.listSkillMarketplaceRepositories({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skillMarketplaceId: ctx.input.skillMarketplaceId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list as any, skillMarketplaceRepositoryPresenter);
    }),

  get: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        skillMarketplaceRepositoryId: v.string()
      })
    )
    .do(async ctx =>
      skillMarketplaceRepositoryPresenter(
        await skillMarketplaceRepositoryService.getSkillMarketplaceRepositoryById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplaceId: ctx.input.skillMarketplaceId,
          skillMarketplaceRepositoryId: ctx.input.skillMarketplaceRepositoryId
        })
      )
    ),

  create: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        repoId: v.string()
      })
    )
    .do(async ctx =>
      skillMarketplaceRepositoryPresenter(
        await skillMarketplaceRepositoryService.createSkillMarketplaceRepository({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplaceId: ctx.input.skillMarketplaceId,
          repoId: ctx.input.repoId
        })
      )
    ),

  delete: skillMarketplaceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillMarketplaceId: v.string(),
        skillMarketplaceRepositoryId: v.string()
      })
    )
    .do(async ctx =>
      skillMarketplaceRepositoryPresenter(
        await skillMarketplaceRepositoryService.deleteSkillMarketplaceRepository({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillMarketplaceId: ctx.input.skillMarketplaceId,
          skillMarketplaceRepositoryId: ctx.input.skillMarketplaceRepositoryId
        })
      )
    )
});
