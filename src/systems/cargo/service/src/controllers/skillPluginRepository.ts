import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { skillPluginRepositoryService } from '@metorial-cargo/module-skill';
import { skillPluginRepositoryPresenter } from '../presenters';
import { app } from './_app';
import { skillPluginApp } from './skillPlugin';

export let skillPluginRepositoryController = app.controller({
  list: skillPluginApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillPluginId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillPluginRepositoryService.listSkillPluginRepositories({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skillPluginId: ctx.input.skillPluginId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list as any, skillPluginRepositoryPresenter);
    }),

  get: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        skillPluginRepositoryId: v.string()
      })
    )
    .do(async ctx =>
      skillPluginRepositoryPresenter(
        await skillPluginRepositoryService.getSkillPluginRepositoryById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPluginId: ctx.input.skillPluginId,
          skillPluginRepositoryId: ctx.input.skillPluginRepositoryId
        })
      )
    ),

  create: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        repoId: v.string()
      })
    )
    .do(async ctx =>
      skillPluginRepositoryPresenter(
        await skillPluginRepositoryService.createSkillPluginRepository({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPluginId: ctx.input.skillPluginId,
          repoId: ctx.input.repoId
        })
      )
    ),

  delete: skillPluginApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillPluginId: v.string(),
        skillPluginRepositoryId: v.string()
      })
    )
    .do(async ctx =>
      skillPluginRepositoryPresenter(
        await skillPluginRepositoryService.deleteSkillPluginRepository({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillPluginId: ctx.input.skillPluginId,
          skillPluginRepositoryId: ctx.input.skillPluginRepositoryId
        })
      )
    )
});
