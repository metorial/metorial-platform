import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { db } from '@metorial/db';
import { consumerSkillService } from '@metorial/module-consumer';
import {
  subspaceSkillGroupItemService,
  subspaceSkillGroupService,
  subspaceSkillService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillPresenter } from '../../../presenters';

let skillClientNameValidator = v.string({
  modifiers: [
    v.minLength(1),
    v.regex(/^(?!-)(?!.*--)[a-z0-9-]+(?<!-)$/, {
      message:
        'Must use lowercase alphanumeric characters or hyphens, cannot start or end with a hyphen, and cannot contain consecutive hyphens.'
    })
  ]
});

let skillClientDescriptionValidator = v.string({
  modifiers: [v.minLength(1)]
});

let skillLicenseValidator = v.string({
  modifiers: [v.minLength(1)]
});

let skillCompatibilityValidator = v.string({
  modifiers: [v.minLength(1)]
});

export let skillGroup = instanceGroup.use(hasFlags(['skills-enabled'])).use(async ctx => {
  if (!ctx.params.skillId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillId is required',
        description: 'The skillId path parameter is required.'
      })
    );
  }

  let skill = await subspaceSkillService.get({
    instance: ctx.instance,
    skillId: ctx.params.skillId,
    allowDeleted: true,
    consumerProfile: ctx.consumerProfile,
    consumerGroups: ctx.consumerGroups
  });

  return { skill };
});

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let assertConsumerCanAddToSkillGroup = async (ctx: {
  consumerProfile?: unknown;
  consumerGroups?: { oid: bigint }[];
  skillGroupId: string;
}) => {
  if (!ctx.consumerProfile) return;

  let allowed = await db.skillGroup.findFirst({
    where: {
      id: ctx.skillGroupId,
      consumerAccesses: {
        some: {
          consumerGroupOid: {
            in: ctx.consumerGroups?.map(group => group.oid) ?? []
          }
        }
      }
    },
    select: { oid: true }
  });

  if (!allowed) {
    throw new ServiceError(
      forbiddenError({
        message: 'Consumer does not have permission to add skills to this group.'
      })
    );
  }
};

export let skillController = Controller.create(
  {
    name: 'Skills',
    description:
      'Skills group provider and integration capabilities into reusable, owned compositions.'
  },
  {
    list: instanceGroup
      .get(instancePath('skills', 'skills.list'), {
        name: 'List skills',
        description: 'Returns a paginated list of skills.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill creation time'),
            updated_at: dateFilterValidator('skill last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSkillService.list({
          instance: ctx.instance,
          consumerProfile: ctx.consumerProfile,
          consumerGroups: ctx.consumerGroups,
          search: ctx.query.search,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          skillGroupIds: normalizeArrayParam(ctx.query.skill_group_id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skill => skillPresenter.present({ skill }));
      }),

    get: skillGroup
      .get(instancePath('skills/:skillId', 'skills.get'), {
        name: 'Get skill',
        description: 'Retrieves a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => {
        return skillPresenter.present({ skill: ctx.skill });
      }),

    create: instanceGroup
      .post(instancePath('skills', 'skills.create'), {
        name: 'Create skill',
        description: 'Creates a new skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),

          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(skillLicenseValidator),
          compatibility: v.optional(skillCompatibilityValidator),
          client_metadata: v.optional(v.record(v.any())),
          image_file_id: v.optional(v.nullable(v.string())),
          template_id: v.optional(v.string()),
          skill_group_id: v.optional(v.string())
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let skillGroupId = ctx.body.skill_group_id;
        if (skillGroupId) {
          await subspaceSkillGroupService.get({
            instance: ctx.instance,
            skillGroupId,
            allowDeleted: true,
            consumerProfile: ctx.consumerProfile,
            consumerGroups: ctx.consumerGroups
          });
          await assertConsumerCanAddToSkillGroup({
            consumerProfile: ctx.consumerProfile,
            consumerGroups: ctx.consumerGroups,
            skillGroupId
          });
        }

        let input = {
          name: ctx.body.name,
          description: ctx.body.description,
          clientName: ctx.body.client_name,
          clientDescription: ctx.body.client_description,
          license: ctx.body.license,
          compatibility: ctx.body.compatibility,
          clientMetadata: ctx.body.client_metadata,
          metadata: ctx.body.metadata,
          imageFileId: ctx.body.image_file_id,
          templateId: ctx.body.template_id
        };
        let skill = ctx.consumerProfile
          ? await consumerSkillService.createConsumerSkill({
              organization: ctx.organization,
              instance: ctx.instance,
              consumerSurface: ctx.consumerSurface!,
              consumerProfile: ctx.consumerProfile,
              consumerGroups: ctx.consumerGroups!,
              input
            })
          : await subspaceSkillService.create({
              instance: ctx.instance,
              organizationActor: ctx.actor!,
              ...input
            });

        if (skillGroupId) {
          await subspaceSkillGroupItemService.create({
            instance: ctx.instance,
            skillGroupId,
            skillId: skill.id
          });
        }

        return skillPresenter.present({ skill });
      }),

    update: skillGroup
      .patch(instancePath('skills/:skillId', 'skills.update'), {
        name: 'Update skill',
        description: 'Updates a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(v.nullable(skillLicenseValidator)),
          compatibility: v.optional(v.nullable(skillCompatibilityValidator)),
          client_metadata: v.optional(v.nullable(v.record(v.any()))),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          image_file_id: v.optional(v.nullable(v.string()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let input = {
          name: ctx.body.name,
          description: ctx.body.description,
          clientName: ctx.body.client_name,
          clientDescription: ctx.body.client_description,
          license: ctx.body.license,
          compatibility: ctx.body.compatibility,
          clientMetadata: ctx.body.client_metadata,
          metadata: ctx.body.metadata,
          imageFileId: ctx.body.image_file_id
        };
        let skill = ctx.consumerProfile
          ? await consumerSkillService.updateConsumerSkill({
              organization: ctx.organization,
              instance: ctx.instance,
              consumerProfile: ctx.consumerProfile,
              skillId: ctx.skill.id,
              input
            })
          : await subspaceSkillService.update({
              instance: ctx.instance,
              skillId: ctx.skill.id,
              allowDeleted: true,
              ...input
            });

        return skillPresenter.present({ skill });
      }),

    delete: skillGroup
      .delete(instancePath('skills/:skillId', 'skills.delete'), {
        name: 'Delete skill',
        description: 'Archives a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => {
        let skill = ctx.consumerProfile
          ? await consumerSkillService.deleteConsumerSkill({
              organization: ctx.organization,
              instance: ctx.instance,
              consumerProfile: ctx.consumerProfile,
              skillId: ctx.skill.id
            })
          : await subspaceSkillService.delete({
              instance: ctx.instance,
              skillId: ctx.skill.id,
              allowDeleted: true
            });

        return skillPresenter.present({ skill });
      }),

    fork: skillGroup
      .post(instancePath('skills/:skillId/fork', 'skills.fork'), {
        name: 'Fork skill',
        description:
          'Forks a skill for the current consumer. Non-consumer callers duplicate the skill instead.',
        hideInDocs: true
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(skillLicenseValidator),
          compatibility: v.optional(skillCompatibilityValidator),
          client_metadata: v.optional(v.record(v.any())),
          metadata: v.optional(v.record(v.any())),
          image_file_id: v.optional(v.nullable(v.string()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let input = {
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          clientName: ctx.body.client_name,
          clientDescription: ctx.body.client_description,
          license: ctx.body.license,
          compatibility: ctx.body.compatibility,
          clientMetadata: ctx.body.client_metadata,
          metadata: ctx.body.metadata,
          imageFileId: ctx.body.image_file_id
        };
        let skill = ctx.consumerProfile
          ? await consumerSkillService.forkConsumerSkill({
              organization: ctx.organization,
              instance: ctx.instance,
              consumerSurface: ctx.consumerSurface!,
              consumerProfile: ctx.consumerProfile,
              consumerGroups: ctx.consumerGroups!,
              parentSkillId: ctx.skill.id,
              input
            })
          : await subspaceSkillService.duplicate({
              instance: ctx.instance,
              organizationActor: ctx.actor!,
              skillId: ctx.skill.id,
              ...input
            });

        return skillPresenter.present({ skill });
      }),

    publishConsumerSkill: skillGroup
      .post(instancePath('skills/:skillId/publish', 'skills.publishConsumerSkill'), {
        name: 'Publish consumer skill',
        description: 'Publishes a consumer-owned skill to the consumer groups they belong to.',
        hideInDocs: true
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['consumer#instance.skill:write'] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => {
        if (!ctx.consumerProfile) {
          throw new ServiceError(
            badRequestError({
              message: 'publishConsumerSkill requires a consumer profile.'
            })
          );
        }

        let skill = await consumerSkillService.publishConsumerSkill({
          organization: ctx.organization,
          instance: ctx.instance,
          consumerSurface: ctx.consumerSurface!,
          consumerProfile: ctx.consumerProfile,
          consumerGroups: ctx.consumerGroups!,
          skillId: ctx.skill.id
        });

        return skillPresenter.present({ skill });
      }),

    duplicate: skillGroup
      .post(instancePath('skills/:skillId/duplicate', 'skills.duplicate'), {
        name: 'Duplicate skill',
        description: 'Duplicates a skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(skillLicenseValidator),
          compatibility: v.optional(skillCompatibilityValidator),
          client_metadata: v.optional(v.record(v.any())),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let skill = await subspaceSkillService.duplicate({
          instance: ctx.instance,
          organizationActor: ctx.actor!,
          skillId: ctx.skill.id,
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          clientName: ctx.body.client_name,
          clientDescription: ctx.body.client_description,
          license: ctx.body.license,
          compatibility: ctx.body.compatibility,
          clientMetadata: ctx.body.client_metadata,
          metadata: ctx.body.metadata
        });

        return skillPresenter.present({ skill });
      })
  }
);
