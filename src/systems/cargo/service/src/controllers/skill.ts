import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillParticipantPresenter, skillPresenter } from '../presenters';
import { skillService, skillTemplateService } from '@metorial-cargo/module-skill';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { storePermissionsSchema } from './document';
import { tenantApp } from './tenant';

export let skillApp = tenantApp.use(async ctx => {
  let skillId = ctx.body.skillId;
  if (!skillId) throw new Error('Skill ID is required');

  let skill = await skillService.getSkillById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    skillId
  });

  return { skill };
});

let skillMetadataSchema = v.optional(v.nullable(v.record(v.any())));
let skillOptionalFieldsSchema = {
  description: v.optional(v.nullable(v.string())),
  metadata: skillMetadataSchema,
  clientName: v.optional(v.nullable(v.string())),
  clientDescription: v.optional(v.nullable(v.string())),
  clientMetadata: skillMetadataSchema,
  license: v.optional(v.nullable(v.string())),
  compatibility: v.optional(v.nullable(v.string()))
};

export let skillController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        actorId: v.optional(v.string()),
        parentSkill: v.optional(
          v.object({
            skillId: v.string(),
            type: v.enumOf(['fork', 'duplicate'])
          })
        ),
        parentSkillTemplateId: v.optional(v.string()),

        name: v.string(),
        ...skillOptionalFieldsSchema,
        imageFileId: v.optional(v.nullable(v.string()))
      })
    )
    .do(async ctx => {
      let parentSkill = ctx.input.parentSkill
        ? await skillService.getSkillById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            skillId: ctx.input.parentSkill.skillId
          })
        : undefined;
      let parentSkillTemplate = ctx.input.parentSkillTemplateId
        ? await skillTemplateService.getSkillTemplateById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            skillTemplateId: ctx.input.parentSkillTemplateId
          })
        : undefined;

      let skill = await skillService.createSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        parentSkill,
        parentSkillCloneType: ctx.input.parentSkill?.type,
        parentSkillTemplate,
        input: {
          id: ctx.input.skillId,
          actorId: ctx.input.actorId,
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          clientName: ctx.input.clientName,
          clientDescription: ctx.input.clientDescription,
          clientMetadata: ctx.input.clientMetadata,
          license: ctx.input.license,
          compatibility: ctx.input.compatibility,
          imageFileId: ctx.input.imageFileId
        }
      });

      return skillPresenter(skill);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillIds: v.optional(v.array(v.string())),
          storeIds: v.optional(v.array(v.string())),
          parentSkillIds: v.optional(v.array(v.string())),
          parentSkillTemplateIds: v.optional(v.array(v.string())),
          createdByActorIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillService.listSkills({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillIds,
        storeIds: ctx.input.storeIds,
        parentSkillIds: ctx.input.parentSkillIds,
        parentSkillTemplateIds: ctx.input.parentSkillTemplateIds,
        createdByActorIds: ctx.input.createdByActorIds,
        createdAt: ctx.input.createdAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillPresenter);
    }),

  get: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string()
      })
    )
    .do(async ctx => skillPresenter(ctx.skill)),

  update: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        name: v.optional(v.string()),
        ...skillOptionalFieldsSchema,
        imageFileId: v.optional(v.nullable(v.string())),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let skill = await skillService.updateSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skill: ctx.skill,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          clientName: ctx.input.clientName,
          clientDescription: ctx.input.clientDescription,
          clientMetadata: ctx.input.clientMetadata,
          license: ctx.input.license,
          compatibility: ctx.input.compatibility,
          imageFileId: ctx.input.imageFileId
        }
      });

      return skillPresenter(skill);
    }),

  delete: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string()
      })
    )
    .do(async ctx => {
      let skill = await skillService.archiveSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skill: ctx.skill
      });

      return skillPresenter(skill);
    }),

  upsertActor: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        actorId: v.string(),
        permissions: storePermissionsSchema
      })
    )
    .do(
      async ctx =>
        await skillService.upsertSkillActor({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skill: ctx.skill,
          actorId: ctx.input.actorId,
          permissions: ctx.input.permissions
        })
    ),

  markSkillUse: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        actorId: v.string()
      })
    )
    .do(async ctx =>
      skillParticipantPresenter(
        await skillService.markSkillUse({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skill: ctx.skill,
          actorId: ctx.input.actorId
        })
      )
    )
});
