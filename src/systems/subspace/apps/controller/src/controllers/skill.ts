import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillService } from '@metorial-subspace/module-skills';
import { actorService } from '@metorial-subspace/module-tenant';
import { skillPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let skillApp = tenantApp.use(async ctx => {
  let skillId = ctx.body.skillId;
  if (!skillId) throw new Error('Skill ID is required');

  let skill = await skillService.getSkillById({
    skillId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { skill };
});

export let skillController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          search: v.optional(v.string()),

          status: v.optional(v.array(v.enumOf(['active', 'archived', 'deleted']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          skillGroupIds: v.optional(v.array(v.string())),
          integrationIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillService.listSkills({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        search: ctx.input.search,
        status: ctx.input.status,
        allowDeleted: ctx.input.allowDeleted,
        ids: ctx.input.ids,
        skillGroupIds: ctx.input.skillGroupIds,
        integrationIds: ctx.input.integrationIds,
        providerIds: ctx.input.providerIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
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
        skillId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => skillPresenter(ctx.skill)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillIds: v.array(v.string()),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let skills = await skillService.getManySkills({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skillIds: ctx.input.skillIds,
        allowDeleted: ctx.input.allowDeleted
      });

      return skills.map(skillPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.optional(v.string()),

        name: v.string(),
        description: v.optional(v.string()),
        clientName: v.optional(v.string()),
        clientDescription: v.optional(v.string()),
        license: v.optional(v.string()),
        compatibility: v.optional(v.string()),
        clientMetadata: v.optional(v.record(v.any())),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any())),
        templateId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let actor = ctx.input.actorId
        ? await actorService.getActorById({
            tenant: ctx.tenant,
            id: ctx.input.actorId
          })
        : undefined;

      let skill = await skillService.createSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          clientName: ctx.input.clientName,
          clientDescription: ctx.input.clientDescription,
          license: ctx.input.license,
          compatibility: ctx.input.compatibility,
          clientMetadata: ctx.input.clientMetadata,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata,
          templateId: ctx.input.templateId
        },
        _operation: {
          type: 'create',
          tenantActor: actor
        }
      });

      return skillPresenter(skill);
    }),

  update: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        clientName: v.optional(v.string()),
        clientDescription: v.optional(v.string()),
        license: v.optional(v.nullable(v.string())),
        compatibility: v.optional(v.nullable(v.string())),
        clientMetadata: v.optional(v.nullable(v.record(v.any()))),
        metadata: v.optional(v.nullable(v.record(v.any()))),
        privateMetadata: v.optional(v.nullable(v.record(v.any())))
      })
    )
    .do(async ctx => {
      let skill = await skillService.updateSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skill: ctx.skill,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          clientName: ctx.input.clientName,
          clientDescription: ctx.input.clientDescription,
          license: ctx.input.license,
          compatibility: ctx.input.compatibility,
          clientMetadata: ctx.input.clientMetadata,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata
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
        skillId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let skill = await skillService.archiveSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skill: ctx.skill
      });

      return skillPresenter(skill);
    }),

  fork: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.string(),

        skillId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.string(),
        description: v.optional(v.string()),
        clientName: v.optional(v.string()),
        clientDescription: v.optional(v.string()),
        license: v.optional(v.string()),
        compatibility: v.optional(v.string()),
        clientMetadata: v.optional(v.record(v.any())),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let tenantActor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      let skill = await skillService.forkSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skill: ctx.skill,
        tenantActor,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          clientName: ctx.input.clientName,
          clientDescription: ctx.input.clientDescription,
          license: ctx.input.license,
          compatibility: ctx.input.compatibility,
          clientMetadata: ctx.input.clientMetadata,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata
        }
      });

      return skillPresenter(skill);
    }),

  duplicate: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.optional(v.string()),

        skillId: v.string(),
        allowDeleted: v.optional(v.boolean()),

        name: v.string(),
        description: v.optional(v.string()),
        clientName: v.optional(v.string()),
        clientDescription: v.optional(v.string()),
        license: v.optional(v.string()),
        compatibility: v.optional(v.string()),
        clientMetadata: v.optional(v.record(v.any())),
        metadata: v.optional(v.record(v.any())),
        privateMetadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let actor = ctx.input.actorId
        ? await actorService.getActorById({
            tenant: ctx.tenant,
            id: ctx.input.actorId
          })
        : undefined;

      let skill = await skillService.duplicateSkill({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skill: ctx.skill,
        actor,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          clientName: ctx.input.clientName,
          clientDescription: ctx.input.clientDescription,
          license: ctx.input.license,
          compatibility: ctx.input.compatibility,
          clientMetadata: ctx.input.clientMetadata,
          metadata: ctx.input.metadata,
          privateMetadata: ctx.input.privateMetadata
        }
      });

      return skillPresenter(skill);
    }),

  upsertActor: skillApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        actorId: v.string(),
        skillId: v.string(),
        allowDeleted: v.optional(v.boolean()),
        permissions: v.array(v.enumOf(['content_read', 'content_write']))
      })
    )
    .do(async ctx => {
      let tenantActor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      return await skillService.upsertSkillActor({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        skill: ctx.skill,
        tenantActor,
        permissions: ctx.input.permissions
      });
    })
});
