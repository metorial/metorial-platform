import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceSkillService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
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

export let skillGroup = instanceGroup.use(async ctx => {
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
    allowDeleted: true
  });

  return { skill };
});

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

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
          search: ctx.query.search,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
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
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => skillPresenter.present({ skill: ctx.skill })),

    create: instanceGroup
      .post(instancePath('skills', 'skills.create'), {
        name: 'Create skill',
        description: 'Creates a new skill.'
      })
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
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let skill = await subspaceSkillService.create({
          instance: ctx.instance,
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
      }),

    update: skillGroup
      .patch(instancePath('skills/:skillId', 'skills.update'), {
        name: 'Update skill',
        description: 'Updates a specific skill.'
      })
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
          metadata: v.optional(v.nullable(v.record(v.any())))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let skill = await subspaceSkillService.update({
          instance: ctx.instance,
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
      }),

    delete: skillGroup
      .delete(instancePath('skills/:skillId', 'skills.delete'), {
        name: 'Delete skill',
        description: 'Archives a specific skill.'
      })
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => {
        let skill = await subspaceSkillService.delete({
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
          'Forks a skill for the current consumer. Non-consumer callers duplicate the skill instead.'
      })
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
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let skill = ctx.consumerProfile
          ? await subspaceSkillService.fork({
              instance: ctx.instance,
              skillId: ctx.skill.id,
              allowDeleted: true,
              consumer: ctx.consumerProfile.consumer,
              name: ctx.body.name,
              description: ctx.body.description,
              clientName: ctx.body.client_name,
              clientDescription: ctx.body.client_description,
              license: ctx.body.license,
              compatibility: ctx.body.compatibility,
              clientMetadata: ctx.body.client_metadata,
              metadata: ctx.body.metadata
            })
          : await subspaceSkillService.duplicate({
              instance: ctx.instance,
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
      }),

    duplicate: skillGroup
      .post(instancePath('skills/:skillId/duplicate', 'skills.duplicate'), {
        name: 'Duplicate skill',
        description: 'Duplicates a skill.'
      })
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
