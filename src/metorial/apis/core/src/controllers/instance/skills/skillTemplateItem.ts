import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillTemplateItemService } from '@metorial/cargo-module-skill';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceLegacyPath, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillTemplateItemPresenter } from '@metorial/presenters';
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

  let skillTemplateItem = await skillTemplateItemService.getSkillTemplateItem({
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
        instancePath('skill-templates/:skillTemplateId/items', 'skills.templates.items.list'),
        {
          name: 'List skill template items',
          description: 'Returns a paginated list of items for a skill template.',
          legacyPaths: instanceLegacyPath('skill-template/:skillTemplateId/items')
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillTemplateItemPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await skillTemplateItemService.listSkillTemplateItems({
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
          'skill-templates/:skillTemplateId/items/:skillTemplateItemId',
          'skills.templates.items.get'
        ),
        {
          name: 'Get skill template item',
          description: 'Retrieves a specific skill template item.',
          legacyPaths: instanceLegacyPath(
            'skill-template/:skillTemplateId/items/:skillTemplateItemId'
          )
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(skillTemplateItemPresenter)
      .do(async ctx =>
        skillTemplateItemPresenter.present({
          skillTemplateItem: ctx.skillTemplateItem
        })
      ),

    create: skillTemplateGroup
      .post(
        instancePath(
          'skill-templates/:skillTemplateId/items',
          'skills.templates.items.create'
        ),
        {
          name: 'Create skill template item',
          description: 'Adds a provider or integration item to a skill template.',
          legacyPaths: instanceLegacyPath('skill-template/:skillTemplateId/items')
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body('default', createSkillTemplateItemValidator)
      .output(skillTemplateItemPresenter)
      .do(async ctx => {
        let skillTemplateItem =
          ctx.body.type === 'integration'
            ? await skillTemplateItemService.createSkillTemplateItem({
                instance: ctx.instance,
                skillTemplateId: ctx.skillTemplate.id,
                input: {
                  type: 'integration',
                  // @ts-ignore validation narrows the matching union branch
                  integrationId: ctx.body.integration_id
                }
              })
            : await skillTemplateItemService.createSkillTemplateItem({
                instance: ctx.instance,
                skillTemplateId: ctx.skillTemplate.id,
                input: {
                  type: 'provider',
                  // @ts-ignore validation narrows the matching union branch
                  providerId: ctx.body.provider_id
                }
              });

        return skillTemplateItemPresenter.present({ skillTemplateItem });
      }),

    delete: skillTemplateItemGroup
      .delete(
        instancePath(
          'skill-templates/:skillTemplateId/items/:skillTemplateItemId',
          'skills.templates.items.delete'
        ),
        {
          name: 'Delete skill template item',
          description: 'Deletes a skill template item.',
          legacyPaths: instanceLegacyPath(
            'skill-template/:skillTemplateId/items/:skillTemplateItemId'
          )
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .output(skillTemplateItemPresenter)
      .do(async ctx => {
        let skillTemplateItem = await skillTemplateItemService.deleteSkillTemplateItem({
          instance: ctx.instance,
          skillTemplateId: ctx.skillTemplate.id,
          skillTemplateItemId: ctx.skillTemplateItem.id
        });

        return skillTemplateItemPresenter.present({ skillTemplateItem });
      })
  }
);
