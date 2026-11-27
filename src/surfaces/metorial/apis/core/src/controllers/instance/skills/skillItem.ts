import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillItemService, skillService } from '@metorial/module-skill';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillItemPresenter } from '@metorial/presenters';
import { skillGroup } from './skill';

let createSkillItemValidator = v.union([
  v.object({
    type: v.literal('provider', {
      description: 'Attach a provider to the skill.'
    }),
    provider_id: v.string({
      description: 'Provider to attach to the skill, by ID.'
    })
  }),
  v.object({
    type: v.literal('integration', {
      description: 'Attach an integration to the skill.'
    }),
    integration_id: v.string({
      description: 'Integration to attach to the skill, by ID.'
    })
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

  let skillItem = await skillItemService.getSkillItemById({
    instance: ctx.instance,
    skillItemId: ctx.params.skillItemId,
    allowDeleted: true
  });
  if (skillItem.skillId !== ctx.skill.id) {
    throw new ServiceError(notFoundError('skill.item', ctx.params.skillItemId));
  }

  return { skillItem };
});

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let assertConsumerCanWriteSkillItems = async (
  ctx: Parameters<typeof getInstanceCargoAccess>[0] & {
    skill: {
      localSkill: Parameters<typeof skillService.assertSkillWriteAccess>[0]['skill'];
    };
  }
) => {
  if (!ctx.consumerProfile) return;

  let access = await getInstanceCargoAccess(ctx);
  await skillService.assertSkillWriteAccess({
    project: access.project,
    instance: access.instance,
    skill: ctx.skill.localSkill,
    authorization: access.authorization
  });
};

export let skillItemController = Controller.create(
  {
    name: 'Skill Items',
    description: 'A skill item is a provider or integration attached to a skill.'
  },
  {
    list: skillGroup
      .get(instancePath('skills/:skillId/items', 'skills.items.list'), {
        name: 'List skill items',
        description: 'Returns a paginated list of skill items.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillItemPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union(
                [
                  v.enumOf(['active', 'archived', 'deleted']),
                  v.array(v.enumOf(['active', 'archived', 'deleted']))
                ],
                {
                  description: 'Only return skill items with one of these statuses.'
                }
              )
            ),
            type: v.optional(
              v.union(
                [
                  v.enumOf(['integration', 'provider']),
                  v.array(v.enumOf(['integration', 'provider']))
                ],
                {
                  description: 'Only return skill items of one of these types.'
                }
              )
            ),
            id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill items with these IDs.'
              })
            ),
            integration_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill items for one of these integrations.'
              })
            ),
            provider_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill items for one of these providers.'
              })
            ),
            created_at: dateFilterValidator('skill item creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillItemService.listSkillItems({
          instance: ctx.instance,
          allowDeleted: false,
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
        description: 'Retrieves a skill item.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillItemPresenter)
      .do(async ctx => skillItemPresenter.present({ skillItem: ctx.skillItem })),

    create: skillGroup
      .post(instancePath('skills/:skillId/items', 'skills.items.create'), {
        name: 'Create skill item',
        description: 'Creates a new item on a skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body('default', createSkillItemValidator)
      .output(skillItemPresenter)
      .do(async ctx => {
        await assertConsumerCanWriteSkillItems(ctx);

        let skillItem =
          ctx.body.type === 'integration'
            ? await skillItemService.createSkillItem({
                instance: ctx.instance,
                input: {
                  skillId: ctx.skill.id,
                  type: 'integration',
                  // @ts-ignore validation narrows the matching union branch
                  integrationId: ctx.body.integration_id
                }
              })
            : await skillItemService.createSkillItem({
                instance: ctx.instance,
                input: {
                  skillId: ctx.skill.id,
                  type: 'provider',
                  // @ts-ignore validation narrows the matching union branch
                  providerId: ctx.body.provider_id
                }
              });

        return skillItemPresenter.present({ skillItem });
      }),

    delete: skillItemGroup
      .delete(instancePath('skills/:skillId/items/:skillItemId', 'skills.items.delete'), {
        name: 'Archive skill item',
        description: 'Archives a skill item.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillItemPresenter)
      .do(async ctx => {
        await assertConsumerCanWriteSkillItems(ctx);

        let skillItem = await skillItemService.archiveSkillItem({
          instance: ctx.instance,
          skillItem: ctx.skillItem
        });

        return skillItemPresenter.present({ skillItem });
      })
  }
);
