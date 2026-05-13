import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  subspaceSkillTemplateItemService,
  subspaceSkillTemplateService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillTemplateItemPresenter } from '../../../presenters';
import { skillTemplateGroup } from './skillTemplate';

export let skillTemplateItemGroup = skillTemplateGroup.use(async ctx => {
  if (!ctx.params.skillTemplateItemId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillTemplateItemId is required',
        description: 'The skillTemplateItemId path parameter is required.'
      })
    );
  }

  let skillTemplateItem = await subspaceSkillTemplateItemService.get({
    instance: ctx.instance,
    skillTemplateId: ctx.skillTemplate.id,
    skillTemplateItemId: ctx.params.skillTemplateItemId
  });

  return { skillTemplateItem };
});

let createSkillTemplateItemValidator = v.union([
  v.object({
    type: v.literal('provider'),
    provider_id: v.string()
  }),
  v.object({
    type: v.literal('integration'),
    integration_id: v.string()
  })
]);

export let skillTemplateItemController = Controller.create(
  {
    name: 'Skill Template Items',
    description:
      'Skill template items link template definitions to provider and integration items.'
  },
  {
    list: skillTemplateGroup
      .get(
        instancePath('skill-template/:skillTemplateId/items', 'skillTemplates.items.list'),
        {
          name: 'List skill template items',
          description: 'Returns a paginated list of items for a skill template.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillTemplateItemPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        if (ctx.consumerProfile) {
          await subspaceSkillTemplateService.get({
            instance: ctx.instance,
            consumerProfile: ctx.consumerProfile,
            consumerGroups: ctx.consumerGroups!,
            skillTemplateId: ctx.skillTemplate.id,
            allowDeleted: true
          });
        }

        let paginator = await subspaceSkillTemplateItemService.list({
          instance: ctx.instance,
          skillTemplateId: ctx.skillTemplate.id
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillTemplateItem =>
          skillTemplateItemPresenter.present({ skillTemplateItem })
        );
      }),

    get: skillTemplateItemGroup
      .get(
        instancePath(
          'skill-template/:skillTemplateId/items/:skillTemplateItemId',
          'skillTemplates.items.get'
        ),
        {
          name: 'Get skill template item',
          description: 'Retrieves a specific skill template item.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(skillTemplateItemPresenter)
      .do(async ctx => {
        if (ctx.consumerProfile) {
          await subspaceSkillTemplateService.get({
            instance: ctx.instance,
            consumerProfile: ctx.consumerProfile,
            consumerGroups: ctx.consumerGroups!,
            skillTemplateId: ctx.skillTemplate.id,
            allowDeleted: true
          });
        }

        return skillTemplateItemPresenter.present({
          skillTemplateItem: ctx.skillTemplateItem
        });
      }),

    create: skillTemplateGroup
      .post(
        instancePath('skill-template/:skillTemplateId/items', 'skillTemplates.items.create'),
        {
          name: 'Create skill template item',
          description: 'Adds a provider or integration item to a skill template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body('default', createSkillTemplateItemValidator)
      .output(skillTemplateItemPresenter)
      .do(async ctx => {
        let skillTemplateItem =
          ctx.body.type === 'integration'
            ? await subspaceSkillTemplateItemService.create({
                instance: ctx.instance,
                skillTemplateId: ctx.skillTemplate.id,
                type: 'integration',

                // @ts-ignore
                integrationId: ctx.body.integration_id
              })
            : await subspaceSkillTemplateItemService.create({
                instance: ctx.instance,
                skillTemplateId: ctx.skillTemplate.id,
                type: 'provider',

                // @ts-ignore
                providerId: ctx.body.provider_id
              });

        return skillTemplateItemPresenter.present({ skillTemplateItem });
      }),

    delete: skillTemplateItemGroup
      .delete(
        instancePath(
          'skill-template/:skillTemplateId/items/:skillTemplateItemId',
          'skillTemplates.items.delete'
        ),
        {
          name: 'Delete skill template item',
          description: 'Deletes a skill template item.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .output(skillTemplateItemPresenter)
      .do(async ctx => {
        let skillTemplateItem = await subspaceSkillTemplateItemService.delete({
          instance: ctx.instance,
          skillTemplateId: ctx.skillTemplate.id,
          skillTemplateItemId: ctx.skillTemplateItem.id
        });

        return skillTemplateItemPresenter.present({ skillTemplateItem });
      })
  }
);
