import { v } from '@lowerdeck/validation';
import { skillTemplateService } from '@metorial-subspace/module-skills';
import { skillTemplatePresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let skillTemplateApp = tenantApp.use(async ctx => {
  let skillTemplateId = ctx.body.skillTemplateId;
  if (!skillTemplateId) throw new Error('SkillTemplate ID is required');
  let skillTemplate = await skillTemplateService.getSkillTemplateById({
    skillTemplateId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });
  return { skillTemplate };
});

export let skillTemplateController = app.controller({
  hydrateResources: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let templates = await skillTemplateService.getManySkillTemplates({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillTemplateIds: ctx.input.skillTemplateIds,
        allowDeleted: true
      });
      return templates.map(template => {
        let presented = skillTemplatePresenter(template);
        return {
          skillTemplateId: template.id,
          items: presented.items
        };
      });
    }),

  syncResourceTarget: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        id: v.string(),
        status: v.enumOf(['active', 'archived', 'deleted']),
        owner: v.enumOf(['system', 'tenant']),
        slug: v.string(),
        name: v.string(),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        storeId: v.optional(v.nullable(v.string())),
        storeTemplateId: v.string(),
        systemIdentifier: v.optional(v.nullable(v.string())),
        sourceSkillId: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => {
      let template = await skillTemplateService.upsertMetorialSkillTemplate({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          id: ctx.input.id,
          status: ctx.input.status,
          owner: ctx.input.owner,
          slug: ctx.input.slug,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          storeId: ctx.input.storeId,
          storeTemplateId: ctx.input.storeTemplateId,
          systemIdentifier: ctx.input.systemIdentifier,
          sourceSkillId: ctx.input.sourceSkillId
        }
      });
      return { skillTemplateId: template.id };
    })
});
