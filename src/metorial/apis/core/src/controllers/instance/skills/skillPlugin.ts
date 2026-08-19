import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  getArchivableSkillPluginIds,
  getWritableSkillPluginIds,
  skillPluginService
} from '@metorial/module-skill-marketplace';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillPluginPresenter } from '@metorial/presenters';
import { getSkillMarketplaceAccessInput } from './_marketplaceAccess';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;
let consumerWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let skillPluginInput = {
  name: v.optional(v.string()),
  description: v.optional(v.nullable(v.string())),
  long_description: v.optional(v.nullable(v.string())),
  category: v.optional(v.nullable(v.string())),
  image_file_id: v.optional(v.nullable(v.string())),
  skill_configuration_id: v.optional(v.nullable(v.string()))
};

export let getSkillPluginAccess = (ctx: Parameters<typeof getInstanceCargoAccess>[0] & any) =>
  getInstanceCargoAccess(ctx);

export let skillPluginGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillPluginId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillPluginId is required',
          description: 'The skillPluginId path parameter is required.'
        })
      );
    }

    if (hasInstanceConsumerAccess(ctx)) {
      let paginator = await skillPluginService.listSkillPlugins({
        ...(await getSkillPluginAccess(ctx)),
        ids: [ctx.params.skillPluginId],
        ...getSkillMarketplaceAccessInput(ctx)
      });
      let list = await paginator.run({ limit: 1 });
      let skillPlugin = list.items[0];
      if (!skillPlugin) {
        throw new ServiceError(notFoundError('skill.plugin', ctx.params.skillPluginId));
      }

      return { skillPlugin };
    }

    let skillPlugin = await skillPluginService.getSkillPluginById({
      ...(await getSkillPluginAccess(ctx)),
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
        let paginator = await skillPluginService.listSkillPlugins({
          ...(await getSkillPluginAccess(ctx)),
          ...getSkillMarketplaceAccessInput(ctx),
          ids: normalizeArrayParam(ctx.query.id),
          skillMarketplaceIds: normalizeArrayParam(ctx.query.skill_marketplace_id),
          statuses: normalizeArrayParam(ctx.query.status),
          category: ctx.query.category,
          search: ctx.query.search,
          skillConfigurationIds: normalizeArrayParam(ctx.query.skill_configuration_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        let [writablePluginIds, archivablePluginIds] = await Promise.all([
          getWritableSkillPluginIds({
            plugins: list.items,
            ...accessInput
          }),
          getArchivableSkillPluginIds({
            plugins: list.items,
            ...accessInput
          })
        ]);

        return Paginator.present(list, skillPlugin =>
          skillPluginPresenter.present({
            skillPlugin,
            ...accessInput,
            pluginAccess: {
              canUpdate: writablePluginIds.has(skillPlugin.id),
              canDelete: archivablePluginIds.has(skillPlugin.id)
            }
          })
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
      .do(async ctx =>
        skillPluginPresenter.present({
          skillPlugin: ctx.skillPlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        })
      ),

    create: instanceGroup
      .post(instancePath('skill-plugins', 'skills.plugins.create'), {
        name: 'Create skill plugin',
        description: 'Creates a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...consumerWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          ...skillPluginInput,
          name: v.string(),
          skill_marketplace_id: v.optional(v.string())
        })
      )
      .output(skillPluginPresenter)
      .do(async ctx => {
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        if (accessInput.accessTags && !ctx.body.skill_marketplace_id) {
          throw new ServiceError(
            badRequestError({
              message: 'skill_marketplace_id is required to create a skill plugin.'
            })
          );
        }

        let skillPlugin = await skillPluginService.createSkillPlugin({
          ...(await getSkillPluginAccess(ctx)),
          ...accessInput,
          skillMarketplaceId: ctx.body.skill_marketplace_id,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            longDescription: ctx.body.long_description,
            category: ctx.body.category,
            imageFileId: ctx.body.image_file_id,
            skillConfigurationId: ctx.body.skill_configuration_id
          }
        });

        return skillPluginPresenter.present({
          skillPlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      }),

    update: skillPluginGroup
      .patch(instancePath('skill-plugins/:skillPluginId', 'skills.plugins.update'), {
        name: 'Update skill plugin',
        description: 'Updates a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...consumerWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body('default', v.object(skillPluginInput))
      .output(skillPluginPresenter)
      .do(async ctx => {
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        let skillPlugin = await skillPluginService.updateSkillPlugin({
          ...(await getSkillPluginAccess(ctx)),
          ...accessInput,
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

        return skillPluginPresenter.present({
          skillPlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      }),

    archive: skillPluginGroup
      .delete(instancePath('skill-plugins/:skillPluginId', 'skills.plugins.archive'), {
        name: 'Archive skill plugin',
        description: 'Archives a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...consumerWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPluginPresenter)
      .do(async ctx => {
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        let skillPlugin = await skillPluginService.archiveSkillPlugin({
          ...(await getSkillPluginAccess(ctx)),
          ...accessInput,
          skillPlugin: ctx.skillPlugin
        });

        return skillPluginPresenter.present({
          skillPlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        });
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
          ...(await getSkillPluginAccess(ctx)),
          skillPlugin: ctx.skillPlugin
        });

        return skillPluginPresenter.present({
          skillPlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      })
  }
);
