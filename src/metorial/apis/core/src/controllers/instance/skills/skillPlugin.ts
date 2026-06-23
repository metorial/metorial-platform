import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillPluginService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillPluginPresenter } from '../../../presenters';
import {
  getConsumerAccessibleSkillMarketplaceIds,
  getReadSkillMarketplaceFilter
} from './_marketplaceAccess';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;

let skillPluginInput = {
  name: v.optional(v.string()),
  description: v.optional(v.nullable(v.string())),
  long_description: v.optional(v.nullable(v.string())),
  category: v.optional(v.nullable(v.string())),
  image_file_id: v.optional(v.nullable(v.string())),
  skill_configuration_id: v.optional(v.nullable(v.string()))
};

export let getSkillPluginAccess = (
  ctx: Parameters<typeof getInstanceCargoAccess>[0] & any
) => ({
  owner: {
    type: 'instance' as const,
    instance: ctx.instance,
    organization: ctx.organization
  },
  ...getInstanceCargoAccess(ctx)
});

export let skillPluginGroup = instanceGroup.use(hasFlags(['skills-enabled'])).use(async ctx => {
  if (!ctx.params.skillPluginId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillPluginId is required',
        description: 'The skillPluginId path parameter is required.'
      })
    );
  }

  if (hasInstanceConsumerAccess(ctx)) {
    let accessibleMarketplaceIds = await getConsumerAccessibleSkillMarketplaceIds({
      instance: ctx.instance,
      consumerGroups: ctx.consumerGroups
    });
    let paginator = await skillPluginService.listSkillPlugins({
      ...getSkillPluginAccess(ctx),
      ids: [ctx.params.skillPluginId],
      skillMarketplaceIds: accessibleMarketplaceIds
    });
    let list = await paginator.run({ limit: 1 });
    let skillPlugin = list.items[0];
    if (!skillPlugin) {
      throw new ServiceError(notFoundError('skill.plugin', ctx.params.skillPluginId));
    }

    return { skillPlugin };
  }

  let skillPlugin = await skillPluginService.getSkillPluginById({
    ...getSkillPluginAccess(ctx),
    skillPluginId: ctx.params.skillPluginId
  });

  return { skillPlugin };
});

export let skillPluginController = Controller.create(
  {
    name: 'Skill Plugins',
    description: 'Manage skill plugins for an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-plugins', 'skills.plugins.list'), {
        name: 'List skill plugins',
        description: 'Returns a paginated list of skill plugins.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillPluginPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_marketplace_id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            category: v.optional(v.string()),
            search: v.optional(v.string()),
            skill_configuration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill plugin creation time'),
            updated_at: dateFilterValidator('skill plugin last update time')
          })
        )
      )
      .do(async ctx => {
        let marketplaceFilter = await getReadSkillMarketplaceFilter(ctx);
        let queryMarketplaceIds = normalizeArrayParam(ctx.query.skill_marketplace_id);
        let skillMarketplaceIds =
          marketplaceFilter == null
            ? queryMarketplaceIds
            : queryMarketplaceIds?.length
              ? queryMarketplaceIds.filter(id => marketplaceFilter.includes(id))
              : marketplaceFilter;

        let paginator = await skillPluginService.listSkillPlugins({
          ...getSkillPluginAccess(ctx),
          ids: normalizeArrayParam(ctx.query.id),
          skillMarketplaceIds,
          statuses: normalizeArrayParam(ctx.query.status),
          category: ctx.query.category,
          search: ctx.query.search,
          skillConfigurationIds: normalizeArrayParam(ctx.query.skill_configuration_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillPlugin =>
          skillPluginPresenter.present({ skillPlugin })
        );
      }),

    get: skillPluginGroup
      .get(instancePath('skill-plugins/:skillPluginId', 'skills.plugins.get'), {
        name: 'Get skill plugin',
        description: 'Retrieves a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPluginPresenter)
      .do(async ctx => skillPluginPresenter.present({ skillPlugin: ctx.skillPlugin })),

    create: instanceGroup
      .post(instancePath('skill-plugins', 'skills.plugins.create'), {
        name: 'Create skill plugin',
        description: 'Creates a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({ ...skillPluginInput, name: v.string() }))
      .output(skillPluginPresenter)
      .do(async ctx => {
        let skillPlugin = await skillPluginService.createSkillPlugin({
          ...getSkillPluginAccess(ctx),
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            longDescription: ctx.body.long_description,
            category: ctx.body.category,
            imageFileId: ctx.body.image_file_id,
            skillConfigurationId: ctx.body.skill_configuration_id
          }
        });

        return skillPluginPresenter.present({ skillPlugin });
      }),

    update: skillPluginGroup
      .patch(instancePath('skill-plugins/:skillPluginId', 'skills.plugins.update'), {
        name: 'Update skill plugin',
        description: 'Updates a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object(skillPluginInput))
      .output(skillPluginPresenter)
      .do(async ctx => {
        let skillPlugin = await skillPluginService.updateSkillPlugin({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            longDescription: ctx.body.long_description,
            category: ctx.body.category,
            imageFileId: ctx.body.image_file_id,
            skillConfigurationId: ctx.body.skill_configuration_id
          }
        });

        return skillPluginPresenter.present({ skillPlugin });
      }),

    archive: skillPluginGroup
      .delete(instancePath('skill-plugins/:skillPluginId', 'skills.plugins.archive'), {
        name: 'Archive skill plugin',
        description: 'Archives a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillPluginPresenter)
      .do(async ctx => {
        let skillPlugin = await skillPluginService.archiveSkillPlugin({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin
        });

        return skillPluginPresenter.present({ skillPlugin });
      }),

    sync: skillPluginGroup
      .post(instancePath('skill-plugins/:skillPluginId/sync', 'skills.plugins.sync'), {
        name: 'Sync skill plugin',
        description: 'Forces a skill plugin sync.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({}))
      .output(skillPluginPresenter)
      .do(async ctx => {
        let skillPlugin = await skillPluginService.forceSkillPluginSync({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin
        });

        return skillPluginPresenter.present({ skillPlugin });
      })
  }
);
