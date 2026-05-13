import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceSkillGroupService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { skillGroupPresenter } from '../../../presenters';

export let skillGroupGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.skillGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillGroupId is required',
        description: 'The skillGroupId path parameter is required.'
      })
    );
  }

  let skillGroup = await subspaceSkillGroupService.get({
    instance: ctx.instance,
    skillGroupId: ctx.params.skillGroupId,
    allowDeleted: true
  });

  return { skillGroup };
});

export let skillGroupController = Controller.create(
  {
    name: 'Skill Groups',
    description: 'Skill groups organize skills into reusable collections.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-groups', 'skillGroups.list'), {
        name: 'List skill groups',
        description: 'Returns a paginated list of skill groups.'
      })
      .use(checkAccess({ possibleScopes: ['instance.skill:read'] }))
      .outputList(skillGroupPresenter)
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
            skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill group creation time'),
            updated_at: dateFilterValidator('skill group last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSkillGroupService.list({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          skillIds: normalizeArrayParam(ctx.query.skill_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillGroup =>
          skillGroupPresenter.present({ skillGroup })
        );
      }),

    get: skillGroupGroup
      .get(instancePath('skill-groups/:skillGroupId', 'skillGroups.get'), {
        name: 'Get skill group',
        description: 'Retrieves a specific skill group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.skill:read'] }))
      .output(skillGroupPresenter)
      .do(async ctx => skillGroupPresenter.present({ skillGroup: ctx.skillGroup })),

    create: instanceGroup
      .post(instancePath('skill-groups', 'skillGroups.create'), {
        name: 'Create skill group',
        description: 'Creates a skill group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          skill_ids: v.optional(v.array(v.string()))
        })
      )
      .output(skillGroupPresenter)
      .do(async ctx => {
        let skillGroup = await subspaceSkillGroupService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          skillIds: ctx.body.skill_ids
        });

        return skillGroupPresenter.present({ skillGroup });
      }),

    update: skillGroupGroup
      .patch(instancePath('skill-groups/:skillGroupId', 'skillGroups.update'), {
        name: 'Update skill group',
        description: 'Updates a skill group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          skill_ids: v.optional(v.array(v.string()))
        })
      )
      .output(skillGroupPresenter)
      .do(async ctx => {
        let skillGroup = await subspaceSkillGroupService.update({
          instance: ctx.instance,
          skillGroupId: ctx.skillGroup.id,
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          skillIds: ctx.body.skill_ids
        });

        return skillGroupPresenter.present({ skillGroup });
      }),

    delete: skillGroupGroup
      .delete(instancePath('skill-groups/:skillGroupId', 'skillGroups.delete'), {
        name: 'Delete skill group',
        description: 'Archives a skill group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .output(skillGroupPresenter)
      .do(async ctx => {
        let skillGroup = await subspaceSkillGroupService.delete({
          instance: ctx.instance,
          skillGroupId: ctx.skillGroup.id,
          allowDeleted: true
        });

        return skillGroupPresenter.present({ skillGroup });
      })
  }
);
