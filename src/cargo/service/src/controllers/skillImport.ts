import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillImportService } from '@metorial-cargo/module-skill';
import { skillImportPresenter } from '../presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

let statusSchema = v.enumOf(['pending', 'processing', 'completed', 'failed']);
let sourceSchema = v.union([
  v.object({
    type: v.literal('public'),
    repositoryUrl: v.string({ modifiers: [v.url()] }),
    ref: v.optional(v.string())
  }),
  v.object({
    type: v.literal('origin'),
    repositoryId: v.string(),
    ref: v.optional(v.string()),
    path: v.optional(v.string())
  })
]);

export let skillImportApp = tenantApp.use(async ctx => {
  let skillImportId = ctx.body.skillImportId;
  if (!skillImportId) throw new Error('Skill import ID is required');

  let skillImport = await skillImportService.getSkillImportById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    actorId: ctx.body.actorId,
    skillImportId
  });
  return { skillImport };
});

export let skillImportController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.optional(v.string()),
        source: sourceSchema
      })
    )
    .do(async ctx =>
      skillImportPresenter(
        await skillImportService.createSkillImport({
          tenant: ctx.tenant,
          environment: ctx.environment,
          actorId: ctx.input.actorId,
          input: ctx.input.source
        })
      )
    ),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          actorId: v.optional(v.string()),
          skillImportIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(statusSchema))
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillImportService.listSkillImports({
        tenant: ctx.tenant,
        environment: ctx.environment,
        actorId: ctx.input.actorId,
        ids: ctx.input.skillImportIds,
        statuses: ctx.input.statuses
      });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, skillImportPresenter);
    }),

  get: skillImportApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.optional(v.string()),
        skillImportId: v.string()
      })
    )
    .do(async ctx => skillImportPresenter(ctx.skillImport))
});
