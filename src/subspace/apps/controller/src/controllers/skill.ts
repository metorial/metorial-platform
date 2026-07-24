import { v } from '@lowerdeck/validation';
import { skillItemInclude, skillService } from '@metorial-subspace/module-skills';
import { db } from '@metorial-subspace/db';
import { actorService } from '@metorial-subspace/module-tenant';
import { skillItemPresenter, skillPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { tenantApp } from './tenant';

export let skillController = app.controller({
  hydrateResources: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let skills = await skillService.getManySkills({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillIds: ctx.input.skillIds,
        allowDeleted: true
      });
      let items = await db.skillItem.findMany({
        where: {
          status: 'active',
          skill: { id: { in: skills.map(skill => skill.id) } }
        },
        include: skillItemInclude
      });
      return skills.map(skill => {
        let presented = skillPresenter(skill);
        return {
          skillId: skill.id,
          items: items.filter(item => item.skill.id === skill.id).map(skillItemPresenter),
          integrations: presented.integrations,
          providers: presented.providers
        };
      });
    }),

  syncResourceTarget: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.optional(v.string()),
        id: v.string(),
        status: v.enumOf(['active', 'archived', 'deleted']),
        slug: v.optional(v.nullable(v.string())),
        name: v.string(),
        description: v.optional(v.nullable(v.string())),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        image: v.optional(v.nullable(v.any())),
        clientName: v.optional(v.nullable(v.string())),
        clientDescription: v.optional(v.nullable(v.string())),
        clientMetadata: v.optional(v.nullable(v.record(v.any()))),
        license: v.optional(v.nullable(v.string())),
        compatibility: v.optional(v.nullable(v.string())),
        storeId: v.string(),
        parentSkillId: v.optional(v.nullable(v.string())),
        parentType: v.optional(v.nullable(v.enumOf(['fork', 'duplicate']))),
        parentTemplateId: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => {
      let actor = ctx.input.actorId
        ? await actorService.getActorById({
            tenant: ctx.tenant,
            id: ctx.input.actorId
          })
        : undefined;
      let skill = await skillService.upsertMetorialSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          id: ctx.input.id,
          status: ctx.input.status,
          slug: ctx.input.slug,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          image: ctx.input.image,
          clientName: ctx.input.clientName,
          clientDescription: ctx.input.clientDescription,
          clientMetadata: ctx.input.clientMetadata,
          license: ctx.input.license,
          compatibility: ctx.input.compatibility,
          storeId: ctx.input.storeId,
          parentSkillId: ctx.input.parentSkillId,
          parentType: ctx.input.parentType,
          parentTemplateId: ctx.input.parentTemplateId
        },
        tenantActor: actor
      });
      return { skillId: skill.id };
    })
});
