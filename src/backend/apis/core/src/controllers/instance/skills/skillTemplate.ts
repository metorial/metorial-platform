import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceSkillTemplateService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillTemplatePresenter } from '../../../presenters';

export let skillTemplateGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillTemplateId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillTemplateId is required',
          description: 'The skillTemplateId path parameter is required.'
        })
      );
    }

    let skillTemplate = await subspaceSkillTemplateService.get({
      instance: ctx.instance,
      skillTemplateId: ctx.params.skillTemplateId,
      allowDeleted: true,
      consumerProfile: ctx.consumerProfile,
      consumerGroups: ctx.consumerGroups
    });

    return { skillTemplate };
  });

export let skillTemplateController = Controller.create(
  {
    name: 'Skill Templates',
    description: 'Skill templates define reusable starting points for skills.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-template', 'skills.templates.list'), {
        name: 'List skill templates',
        description: 'Returns a paginated list of skill templates.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillTemplatePresenter)
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
            owner: v.optional(
              v.union([
                v.enumOf(['system', 'tenant']),
                v.array(v.enumOf(['system', 'tenant']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill template creation time'),
            updated_at: dateFilterValidator('skill template last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSkillTemplateService.list({
          instance: ctx.instance,
          consumerProfile: ctx.consumerProfile,
          consumerGroups: ctx.consumerGroups,
          search: ctx.query.search,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          owner: normalizeArrayParam(ctx.query.owner),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillTemplate =>
          skillTemplatePresenter.present({ skillTemplate })
        );
      }),

    get: skillTemplateGroup
      .get(instancePath('skill-template/:skillTemplateId', 'skills.templates.get'), {
        name: 'Get skill template',
        description: 'Retrieves a specific skill template.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(skillTemplatePresenter)
      .do(async ctx => {
        return skillTemplatePresenter.present({ skillTemplate: ctx.skillTemplate });
      }),

    create: instanceGroup
      .post(instancePath('skill-template', 'skills.templates.create'), {
        name: 'Create skill template',
        description: 'Creates a skill template.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          from_skill_Id: v.optional(v.string())
        })
      )
      .output(skillTemplatePresenter)
      .do(async ctx => {
        let skillTemplate = await subspaceSkillTemplateService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          skillId: ctx.body.from_skill_Id
        });

        return skillTemplatePresenter.present({ skillTemplate });
      }),

    update: skillTemplateGroup
      .patch(instancePath('skill-template/:skillTemplateId', 'skills.templates.update'), {
        name: 'Update skill template',
        description: 'Updates a skill template.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.nullable(v.record(v.any())))
        })
      )
      .output(skillTemplatePresenter)
      .do(async ctx => {
        let skillTemplate = await subspaceSkillTemplateService.update({
          instance: ctx.instance,
          skillTemplateId: ctx.skillTemplate.id,
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return skillTemplatePresenter.present({ skillTemplate });
      }),

    delete: skillTemplateGroup
      .delete(instancePath('skill-template/:skillTemplateId', 'skills.templates.delete'), {
        name: 'Delete skill template',
        description: 'Archives a skill template.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .output(skillTemplatePresenter)
      .do(async ctx => {
        let skillTemplate = await subspaceSkillTemplateService.delete({
          instance: ctx.instance,
          skillTemplateId: ctx.skillTemplate.id,
          allowDeleted: true
        });

        return skillTemplatePresenter.present({ skillTemplate });
      })
  }
);
