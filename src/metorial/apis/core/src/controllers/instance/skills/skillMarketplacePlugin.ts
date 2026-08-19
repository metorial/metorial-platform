import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  getArchivableSkillPluginIds,
  getWritableSkillPluginIds,
  skillMarketplacePluginService
} from '@metorial/module-skill-marketplace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillMarketplacePluginPresenter } from '@metorial/presenters';
import { getSkillMarketplaceAccessInput } from './_marketplaceAccess';
import { skillMarketplaceGroup } from './skillMarketplace';
import { getSkillPluginAccess } from './skillPlugin';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

export let skillMarketplacePluginGroup = skillMarketplaceGroup.use(async ctx => {
  if (!ctx.params.skillMarketplacePluginId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillMarketplacePluginId is required',
        description: 'The skillMarketplacePluginId path parameter is required.'
      })
    );
  }

  let skillMarketplacePlugin = await skillMarketplacePluginService.getSkillMarketplacePluginById({
    ...(await getSkillPluginAccess(ctx)),
    skillMarketplace: ctx.skillMarketplace,
    skillMarketplacePluginId: ctx.params.skillMarketplacePluginId
  });

  return { skillMarketplacePlugin };
});

export let skillMarketplacePluginController = Controller.create(
  {
    name: 'Skill Marketplace Plugins',
    description: 'Manage plugin links for skill marketplaces.'
  },
  {
    list: skillMarketplaceGroup
      .get(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/plugins',
          'skills.marketplaces.plugins.list'
        ),
        {
          name: 'List skill marketplace plugins',
          description: 'Returns plugins linked to a skill marketplace.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillMarketplacePluginPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_plugin_id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            skill_configuration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill marketplace plugin creation time'),
            updated_at: dateFilterValidator('skill marketplace plugin last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillMarketplacePluginService.listSkillMarketplacePlugins({
          ...(await getSkillPluginAccess(ctx)),
          skillMarketplace: ctx.skillMarketplace,
          ids: normalizeArrayParam(ctx.query.id),
          skillPluginIds: normalizeArrayParam(ctx.query.skill_plugin_id),
          statuses: normalizeArrayParam(ctx.query.status),
          skillConfigurationIds: normalizeArrayParam(ctx.query.skill_configuration_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        let nestedPlugins = list.items.flatMap(item =>
          item.skillPlugin ? [item.skillPlugin] : []
        );
        let [writablePluginIds, archivablePluginIds] = await Promise.all([
          getWritableSkillPluginIds({
            plugins: nestedPlugins,
            ...accessInput
          }),
          getArchivableSkillPluginIds({
            plugins: nestedPlugins,
            ...accessInput
          })
        ]);

        return Paginator.present(list, skillMarketplacePlugin =>
          skillMarketplacePluginPresenter.present({
            skillMarketplacePlugin,
            ...accessInput,
            pluginAccess: skillMarketplacePlugin.skillPlugin
              ? {
                  canUpdate: writablePluginIds.has(skillMarketplacePlugin.skillPlugin.id),
                  canDelete: archivablePluginIds.has(skillMarketplacePlugin.skillPlugin.id)
                }
              : undefined
          })
        );
      }),

    add: skillMarketplaceGroup
      .post(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/plugins',
          'skills.marketplaces.plugins.add'
        ),
        {
          name: 'Add skill marketplace plugin',
          description: 'Adds a skill plugin to a skill marketplace.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          skill_plugin_id: v.string(),
          skill_configuration_id: v.optional(v.nullable(v.string())),
          identifier: v.optional(v.string())
        })
      )
      .output(skillMarketplacePluginPresenter)
      .do(async ctx => {
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        let skillMarketplacePlugin =
          await skillMarketplacePluginService.addSkillMarketplacePlugin({
            ...(await getSkillPluginAccess(ctx)),
            ...accessInput,
            skillMarketplace: ctx.skillMarketplace,
            input: {
              skillPluginId: ctx.body.skill_plugin_id,
              pluginSlug: ctx.body.identifier,
              skillConfigurationId: ctx.body.skill_configuration_id
            }
          });

        return skillMarketplacePluginPresenter.present({
          skillMarketplacePlugin,
          ...accessInput
        });
      }),

    get: skillMarketplacePluginGroup
      .get(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/plugins/:skillMarketplacePluginId',
          'skills.marketplaces.plugins.get'
        ),
        {
          name: 'Get skill marketplace plugin',
          description: 'Retrieves a skill marketplace plugin link.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillMarketplacePluginPresenter)
      .do(async ctx =>
        skillMarketplacePluginPresenter.present({
          skillMarketplacePlugin: ctx.skillMarketplacePlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        })
      ),

    remove: skillMarketplacePluginGroup
      .delete(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/plugins/:skillMarketplacePluginId',
          'skills.marketplaces.plugins.remove'
        ),
        {
          name: 'Remove skill marketplace plugin',
          description: 'Removes a skill plugin from a skill marketplace.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillMarketplacePluginPresenter)
      .do(async ctx => {
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        let skillMarketplacePlugin =
          await skillMarketplacePluginService.removeSkillMarketplacePlugin({
            ...(await getSkillPluginAccess(ctx)),
            ...accessInput,
            skillMarketplacePlugin: ctx.skillMarketplacePlugin
          });

        return skillMarketplacePluginPresenter.present({
          skillMarketplacePlugin,
          ...accessInput
        });
      })
  }
);
