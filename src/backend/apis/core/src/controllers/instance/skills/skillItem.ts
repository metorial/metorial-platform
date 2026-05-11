import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceSkillItemService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillItemPresenter } from '../../../presenters';
import { skillGroup } from './skill';

let createSkillItemValidator = v.union([
  v.object({
    type: v.literal('provider'),
    provider_id: v.string()
  }),
  v.object({
    type: v.literal('integration'),
    integration_id: v.string()
  })
]);

export let skillItemGroup = skillGroup.use(async ctx => {
  if (!ctx.params.skillItemId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillItemId is required',
        description: 'The skillItemId path parameter is required.'
      })
    );
  }

  let skillItem = await subspaceSkillItemService.get({
    instance: ctx.instance,
    skillItemId: ctx.params.skillItemId,
    allowDeleted: true
  });
  if (skillItem.skillId !== ctx.skill.id) {
    throw new ServiceError(
      badRequestError({
        message: 'Skill item does not belong to the requested skill.'
      })
    );
  }

  return { skillItem };
});

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

export let skillItemController = Controller.create(
  {
    name: 'Skill Items',
    description: 'Skill items attach integrations and providers to skills.'
  },
  {
    list: skillGroup
      .get(instancePath('skills/:skillId/items', 'skills.items.list'), {
        name: 'List skill items',
        description: 'Returns a paginated list of items for a skill.'
      })
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillItemPresenter)
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
            type: v.optional(
              v.union([
                v.enumOf(['integration', 'provider']),
                v.array(v.enumOf(['integration', 'provider']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill item creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSkillItemService.list({
          instance: ctx.instance,
          allowDeleted: true,
          skillIds: [ctx.skill.id],
          status: normalizeArrayParam(ctx.query.status),
          type: normalizeArrayParam(ctx.query.type),
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillItem => skillItemPresenter.present({ skillItem }));
      }),

    get: skillItemGroup
      .get(instancePath('skills/:skillId/items/:skillItemId', 'skills.items.get'), {
        name: 'Get skill item',
        description: 'Retrieves a specific skill item.'
      })
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillItemPresenter)
      .do(async ctx => skillItemPresenter.present({ skillItem: ctx.skillItem })),

    create: skillGroup
      .post(instancePath('skills/:skillId/items', 'skills.items.create'), {
        name: 'Create skill item',
        description: 'Creates a new item on a skill.'
      })
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body('default', createSkillItemValidator)
      .output(skillItemPresenter)
      .do(async ctx => {
        let skillItem =
          ctx.body.type === 'integration'
            ? await subspaceSkillItemService.create({
                instance: ctx.instance,
                skillId: ctx.skill.id,
                type: 'integration',
                integrationId: ctx.body.integration_id
              })
            : await subspaceSkillItemService.create({
                instance: ctx.instance,
                skillId: ctx.skill.id,
                type: 'provider',
                providerId: ctx.body.provider_id
              });

        return skillItemPresenter.present({ skillItem });
      }),

    delete: skillItemGroup
      .delete(instancePath('skills/:skillId/items/:skillItemId', 'skills.items.delete'), {
        name: 'Delete skill item',
        description: 'Archives a skill item.'
      })
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillItemPresenter)
      .do(async ctx => {
        let skillItem = await subspaceSkillItemService.delete({
          instance: ctx.instance,
          skillItemId: ctx.skillItem.id,
          allowDeleted: true
        });

        return skillItemPresenter.present({ skillItem });
      })
  }
);
