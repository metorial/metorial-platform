import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillConfigurationPresenter } from '../presenters';
import { skillConfigurationService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

let skillConfigurationInput = {
  allowScripts: v.optional(v.boolean()),
  allowedFileExtensions: v.optional(v.nullable(v.array(v.string()))),
  allowNonStandardDirectories: v.optional(v.boolean())
};

export let skillConfigurationController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        ...skillConfigurationInput,
        isInternal: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      skillConfigurationPresenter(
        await skillConfigurationService.createSkillConfiguration({
          tenant: ctx.tenant,
          environment: ctx.environment,
          input: {
            allowScripts: ctx.input.allowScripts,
            allowedFileExtensions: ctx.input.allowedFileExtensions,
            allowNonStandardDirectories: ctx.input.allowNonStandardDirectories,
            isInternal: ctx.input.isInternal
          }
        })
      )
    ),

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
      let paginator = await skillConfigurationService.listSkillConfigurations({
        tenant: ctx.tenant,
        environment: ctx.environment
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillConfigurationPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillConfigurationId: v.string()
      })
    )
    .do(async ctx =>
      skillConfigurationPresenter(
        await skillConfigurationService.getSkillConfigurationById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillConfigurationId: ctx.input.skillConfigurationId
        })
      )
    ),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillConfigurationIds: v.array(v.string())
      })
    )
    .do(async ctx =>
      (
        await skillConfigurationService.getManySkillConfigurations({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillConfigurationIds: ctx.input.skillConfigurationIds
        })
      ).map(skillConfigurationPresenter)
    ),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillConfigurationId: v.string(),
        ...skillConfigurationInput
      })
    )
    .do(async ctx =>
      skillConfigurationPresenter(
        await skillConfigurationService.updateSkillConfiguration({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillConfigurationId: ctx.input.skillConfigurationId,
          input: {
            allowScripts: ctx.input.allowScripts,
            allowedFileExtensions: ctx.input.allowedFileExtensions,
            allowNonStandardDirectories: ctx.input.allowNonStandardDirectories
          }
        })
      )
    ),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillConfigurationId: v.string()
      })
    )
    .do(async ctx =>
      skillConfigurationPresenter(
        await skillConfigurationService.deleteSkillConfiguration({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillConfigurationId: ctx.input.skillConfigurationId
        })
      )
    )
});
