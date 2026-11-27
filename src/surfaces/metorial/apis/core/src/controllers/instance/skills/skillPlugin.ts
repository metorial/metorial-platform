import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  getArchivableSkillPluginIds,
  getReadablePluginSkillGroupIds,
  getReadablePluginSkillIds,
  getWritableSkillPluginIds,
  skillGroupPluginService,
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
import {
  skillPluginPresenter,
  skillPluginSkillGroupMatchPresenter
} from '@metorial/presenters';
import { getSkillMarketplaceAccessInput } from './_marketplaceAccess';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;
let consumerWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let skillPluginInput = {
  name: v.optional(v.string(), { description: 'Display name.' }),
  description: v.optional(v.nullable(v.string()), {
    description: 'Free-text description. `null` clears it.'
  }),
  long_description: v.optional(v.nullable(v.string()), {
    description: 'Longer description shown on the marketplace. `null` clears it.'
  }),
  category: v.optional(v.nullable(v.string()), {
    description: 'Category for grouping plugins on the marketplace. `null` clears it.'
  }),
  image_file_id: v.optional(v.nullable(v.string()), {
    description: 'Image file for the plugin, by ID. `null` resets to the default image.'
  }),
  skill_configuration_id: v.optional(v.nullable(v.string()), {
    description:
      'Skill configuration for the plugin, by ID. `null` uses the default configuration.'
  })
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
    description: 'A skill plugin is a set of skills distributed through a skill marketplace.'
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
            id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill plugins with these IDs.'
              })
            ),
            skill_marketplace_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill plugins in one of these marketplaces.'
              })
            ),
            status: v.optional(
              v.union(
                [
                  v.enumOf(['active', 'archived', 'deleted']),
                  v.array(v.enumOf(['active', 'archived', 'deleted']))
                ],
                {
                  description: 'Only return skill plugins with one of these statuses.'
                }
              )
            ),
            category: v.optional(
              v.string({ description: 'Only return skill plugins in this category.' })
            ),
            search: v.optional(
              v.string({
                description: 'Only return skill plugins matching this search text.'
              })
            ),
            skill_configuration_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description:
                  'Only return skill plugins using one of these skill configurations.'
              })
            ),
            skill_group_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return plugins whose skills are synced from these skill groups.'
            }),
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
          skillGroupIds: normalizeArrayParam(ctx.query.skill_group_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);
        let accessInput = getSkillMarketplaceAccessInput(ctx);
        let [writablePluginIds, archivablePluginIds, readableSkillIds, readableSkillGroupIds] =
          await Promise.all([
            getWritableSkillPluginIds({
              plugins: list.items,
              ...accessInput
            }),
            getArchivableSkillPluginIds({
              plugins: list.items,
              ...accessInput
            }),
            getReadablePluginSkillIds({
              plugins: list.items,
              ...accessInput
            }),
            getReadablePluginSkillGroupIds({
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
              canDelete: archivablePluginIds.has(skillPlugin.id),
              readableSkillIds,
              readableSkillGroupIds
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
          name: v.optional(v.string(), {
            description:
              'The plugin name. Required unless skill_group_id is set, in which case it defaults to the group name.'
          }),
          skill_marketplace_id: v.optional(
            v.string({
              description:
                'Marketplace to publish the plugin to, by ID. Required for consumers.'
            })
          ),
          skill_group_id: v.optional(v.string(), {
            description:
              "Creates the plugin from a skill group. The group's skills are synced into the plugin automatically and cannot be edited on the plugin directly. Name and description are copied from the group once and can be changed afterwards.",
            examples: ['skg_0mbgjh8iMEI3ZMm2r2iP0P']
          })
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
            skillGroupId: ctx.body.skill_group_id,
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
        description: 'Updates a skill plugin. Omitted fields keep their current value.'
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

    attachSkillGroup: skillPluginGroup
      .post(
        instancePath(
          'skill-plugins/:skillPluginId/attach-skill-group',
          'skills.plugins.attachSkillGroup'
        ),
        {
          name: 'Attach skill plugin to skill group',
          description:
            "Starts syncing a plugin from a skill group. The plugin's skills are replaced with the group's skills right away and follow the group from then on."
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          skill_group_id: v.string({
            description: 'Skill group to sync the plugin from.',
            examples: ['skg_0mbgjh8iMEI3ZMm2r2iP0P']
          })
        })
      )
      .output(skillPluginPresenter)
      .do(async ctx => {
        let skillPlugin = await skillGroupPluginService.attachSkillGroupPlugin({
          ...(await getSkillPluginAccess(ctx)),
          skillPlugin: ctx.skillPlugin,
          skillGroupId: ctx.body.skill_group_id
        });

        return skillPluginPresenter.present({
          skillPlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      }),

    detachSkillGroup: skillPluginGroup
      .post(
        instancePath(
          'skill-plugins/:skillPluginId/detach-skill-group',
          'skills.plugins.detachSkillGroup'
        ),
        {
          name: 'Detach skill plugin from skill group',
          description:
            'Stops syncing a plugin from its skill group. The plugin keeps its current skills, which can then be edited directly.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({}))
      .output(skillPluginPresenter)
      .do(async ctx => {
        let skillPlugin = await skillGroupPluginService.detachSkillGroupPlugin({
          ...(await getSkillPluginAccess(ctx)),
          skillPlugin: ctx.skillPlugin
        });

        return skillPluginPresenter.present({
          skillPlugin,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      }),

    listSkillGroupMatches: skillPluginGroup
      .get(
        instancePath(
          'skill-plugins/:skillPluginId/skill-group-matches',
          'skills.plugins.skillGroupMatches.list'
        ),
        {
          name: 'List skill group matches',
          description:
            'Compares a skill plugin with skill groups and returns the skills attaching each group would add or remove. Without a filter, returns up to 5 groups that share the most skills with the plugin.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:read'] }))
      .query(
        'default',
        v.object({
          skill_group_id: v.optional(
            v.union([v.string(), v.array(v.string())], {
              description: 'Only compare with these skill groups, up to 5.'
            })
          )
        })
      )
      .outputList(skillPluginSkillGroupMatchPresenter)
      .do(async ctx => {
        let matches = await skillGroupPluginService.listSkillGroupMatches({
          ...(await getSkillPluginAccess(ctx)),
          skillPlugin: ctx.skillPlugin,
          skillGroupIds: normalizeArrayParam(ctx.query.skill_group_id)
        });

        return Paginator.present(
          { items: matches, pagination: { hasNextPage: false, hasPreviousPage: false } },
          match =>
            skillPluginSkillGroupMatchPresenter.present({
              skillGroupMatch: { ...match, skillPlugin: ctx.skillPlugin }
            })
        );
      }),

    sync: skillPluginGroup
      .post(instancePath('skill-plugins/:skillPluginId/sync', 'skills.plugins.sync'), {
        name: 'Sync skill plugin',
        description:
          'Starts a sync of the skill plugin to its linked repositories, even if nothing changed.'
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
