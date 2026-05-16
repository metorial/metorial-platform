import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillExportService } from '@metorial-cargo/module-skill';
import { skillExportPresenter } from '../presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let skillExportApp = tenantApp.use(async ctx => {
  let skillExportId = ctx.body.skillExportId;
  if (!skillExportId) throw new Error('Skill export ID is required');

  let skillExport = await skillExportService.getSkillExportById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillExportId,
    actorId: ctx.body.actorId
  });

  return { skillExport };
});

let targetSchema = v.enumOf(['skill', 'plugin', 'marketplace']);
let statusSchema = v.enumOf(['pending', 'completed', 'failed']);

export let skillExportController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        target: targetSchema,
        skillId: v.optional(v.string()),
        skillPluginId: v.optional(v.string()),
        skillMarketplaceId: v.optional(v.string()),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let input =
        ctx.input.target === 'skill'
          ? ({
              target: 'skill',
              skillId: ctx.input.skillId!
            } as const)
          : ctx.input.target === 'plugin'
            ? ({
                target: 'plugin',
                skillPluginId: ctx.input.skillPluginId!
              } as const)
            : ({
                target: 'marketplace',
                skillMarketplaceId: ctx.input.skillMarketplaceId!
              } as const);

      return skillExportPresenter(
        await skillExportService.createSkillExport({
          tenant: ctx.tenant,
          environment: ctx.environment,
          actorId: ctx.input.actorId,
          input
        })
      );
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillExportIds: v.optional(v.array(v.string())),
          targets: v.optional(v.array(targetSchema)),
          statuses: v.optional(v.array(statusSchema)),
          actorId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillExportService.listSkillExports({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillExportIds,
        targets: ctx.input.targets,
        statuses: ctx.input.statuses,
        actorId: ctx.input.actorId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillExportPresenter);
    }),

  get: skillExportApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillExportId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => skillExportPresenter(ctx.skillExport))
});
