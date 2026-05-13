import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceSkillGroupItemService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { skillGroupItemPresenter } from '../../../presenters';
import { skillGroupGroup } from './skillGroup';

export let skillGroupItemGroup = skillGroupGroup.use(async ctx => {
  if (!ctx.params.skillGroupItemId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillGroupItemId is required',
        description: 'The skillGroupItemId path parameter is required.'
      })
    );
  }

  let skillGroupItem = await subspaceSkillGroupItemService.get({
    instance: ctx.instance,
    skillGroupItemId: ctx.params.skillGroupItemId,
    allowDeleted: true
  });
  if (skillGroupItem.skillGroupId !== ctx.skillGroup.id) {
    throw new ServiceError(
      badRequestError({
        message: 'Skill group item does not belong to the requested skill group.'
      })
    );
  }

  return { skillGroupItem };
});

export let skillGroupItemController = Controller.create(
  {
    name: 'Skill Group Items',
    description: 'Skill group items link groups to skills.'
  },
  {
    list: skillGroupGroup
      .get(instancePath('skill-groups/:skillGroupId/items', 'skillGroups.items.list'), {
        name: 'List skill group items',
        description: 'Returns a paginated list of items for a skill group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.skill:read'] }))
      .outputList(skillGroupItemPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill group item creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSkillGroupItemService.list({
          instance: ctx.instance,
          allowDeleted: true,
          skillGroupIds: [ctx.skillGroup.id],
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          skillIds: normalizeArrayParam(ctx.query.skill_id),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillGroupItem =>
          skillGroupItemPresenter.present({ skillGroupItem })
        );
      }),

    get: skillGroupItemGroup
      .get(
        instancePath(
          'skill-groups/:skillGroupId/items/:skillGroupItemId',
          'skillGroups.items.get'
        ),
        {
          name: 'Get skill group item',
          description: 'Retrieves a specific skill group item.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.skill:read'] }))
      .output(skillGroupItemPresenter)
      .do(async ctx =>
        skillGroupItemPresenter.present({ skillGroupItem: ctx.skillGroupItem })
      ),

    create: skillGroupGroup
      .post(instancePath('skill-groups/:skillGroupId/items', 'skillGroups.items.create'), {
        name: 'Create skill group item',
        description: 'Adds a skill to a skill group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          skill_id: v.string()
        })
      )
      .output(skillGroupItemPresenter)
      .do(async ctx => {
        let skillGroupItem = await subspaceSkillGroupItemService.create({
          instance: ctx.instance,
          skillGroupId: ctx.skillGroup.id,
          skillId: ctx.body.skill_id
        });

        return skillGroupItemPresenter.present({ skillGroupItem });
      }),

    delete: skillGroupItemGroup
      .delete(
        instancePath(
          'skill-groups/:skillGroupId/items/:skillGroupItemId',
          'skillGroups.items.delete'
        ),
        {
          name: 'Delete skill group item',
          description: 'Archives a skill group item.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .output(skillGroupItemPresenter)
      .do(async ctx => {
        let skillGroupItem = await subspaceSkillGroupItemService.delete({
          instance: ctx.instance,
          skillGroupItemId: ctx.skillGroupItem.id,
          allowDeleted: true
        });

        return skillGroupItemPresenter.present({ skillGroupItem });
      })
  }
);
