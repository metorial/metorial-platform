import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillAgentService } from '@metorial-cargo/module-skill';
import { skillAgentPresenter } from '../presenters';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { storePermissionsSchema } from './document';
import { skillApp } from './skill';
import { tenantApp } from './tenant';

export let skillAgentApp = tenantApp.use(async ctx => {
  let skillAgentId = ctx.body.skillAgentId;
  if (!skillAgentId) throw new Error('Skill agent ID is required');

  let skillAgent = await skillAgentService.getSkillAgentById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillAgentId
  });

  return { skillAgent };
});

export let skillAgentController = app.controller({
  create: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        name: v.string(),
        description: v.optional(v.nullable(v.string())),
        content: v.optional(v.string()),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      skillAgentPresenter(
        await skillAgentService.createSkillAgent({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skill: ctx.skill,
          input: {
            name: ctx.input.name,
            description: ctx.input.description,
            content: ctx.input.content,
            actorId: ctx.input.actorId,
            defaultPermissions: ctx.input.defaultPermissions,
            overridePermissions: ctx.input.overridePermissions
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
          environmentId: v.string(),
          skillAgentIds: v.optional(v.array(v.string())),
          skillId: v.string(),
          documentIds: v.optional(v.array(v.string())),
          storeItemIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema,
          archivedAt: dateFilterSchema,
          includeArchived: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillAgentService.listSkillAgents({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillAgentIds,
        skillId: ctx.input.skillId,
        documentIds: ctx.input.documentIds,
        storeItemIds: ctx.input.storeItemIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt,
        archivedAt: ctx.input.archivedAt,
        includeArchived: ctx.input.includeArchived
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillAgentPresenter);
    }),

  get: skillAgentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillAgentId: v.string()
      })
    )
    .do(async ctx => skillAgentPresenter(ctx.skillAgent)),

  update: skillAgentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillAgentId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      skillAgentPresenter(
        await skillAgentService.updateSkillAgent({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillAgent: ctx.skillAgent,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions,
          input: {
            name: ctx.input.name,
            description: ctx.input.description
          }
        })
      )
    ),

  delete: skillAgentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillAgentId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      skillAgentPresenter(
        await skillAgentService.deleteSkillAgent({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillAgent: ctx.skillAgent,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      )
    )
});
