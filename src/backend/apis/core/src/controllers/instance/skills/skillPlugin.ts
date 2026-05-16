import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillPluginRepositoryService, skillPluginService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import {
  bucketEditorTokenPresenter,
  skillPluginPresenter,
  skillPluginRepositoryPresenter
} from '../../../presenters';
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

export let skillPluginGroup = instanceGroup.use(async ctx => {
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
            slug: v.optional(v.string()),
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
          slug: ctx.query.slug,
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
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPluginPresenter)
      .do(async ctx => skillPluginPresenter.present({ skillPlugin: ctx.skillPlugin })),

    create: instanceGroup
      .post(instancePath('skill-plugins', 'skills.plugins.create'), {
        name: 'Create skill plugin',
        description: 'Creates a skill plugin.'
      })
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
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({}))
      .output(skillPluginPresenter)
      .do(async ctx => {
        let skillPlugin = await skillPluginService.forceSkillPluginSync({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin
        });

        return skillPluginPresenter.present({ skillPlugin });
      }),

    listRepositories: skillPluginGroup
      .get(
        instancePath(
          'skill-plugins/:skillPluginId/repositories',
          'skills.plugins.repositories.list'
        ),
        {
          name: 'List skill plugin repositories',
          description: 'Returns repositories linked to a skill plugin.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillPluginRepositoryPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await skillPluginRepositoryService.listSkillPluginRepositories({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillPluginRepository =>
          skillPluginRepositoryPresenter.present({ skillPluginRepository })
        );
      }),

    getRepository: skillPluginGroup
      .get(
        instancePath(
          'skill-plugins/:skillPluginId/repositories/:skillPluginRepositoryId',
          'skills.plugins.repositories.get'
        ),
        {
          name: 'Get skill plugin repository',
          description: 'Retrieves a repository linked to a skill plugin.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPluginRepositoryPresenter)
      .do(async ctx => {
        let skillPluginRepository =
          await skillPluginRepositoryService.getSkillPluginRepositoryById({
            ...getSkillPluginAccess(ctx),
            skillPlugin: ctx.skillPlugin,
            skillPluginRepositoryId: ctx.params.skillPluginRepositoryId
          });

        return skillPluginRepositoryPresenter.present({ skillPluginRepository });
      }),

    createRepository: skillPluginGroup
      .post(
        instancePath(
          'skill-plugins/:skillPluginId/repositories',
          'skills.plugins.repositories.create'
        ),
        {
          name: 'Link skill plugin repository',
          description: 'Links an SCM repository to a skill plugin.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          repo_id: v.string()
        })
      )
      .output(skillPluginRepositoryPresenter)
      .do(async ctx => {
        let skillPluginRepository =
          await skillPluginRepositoryService.createSkillPluginRepository({
            ...getSkillPluginAccess(ctx),
            skillPlugin: ctx.skillPlugin,
            repoId: ctx.body.repo_id
          });

        return skillPluginRepositoryPresenter.present({ skillPluginRepository });
      }),

    deleteRepository: skillPluginGroup
      .delete(
        instancePath(
          'skill-plugins/:skillPluginId/repositories/:skillPluginRepositoryId',
          'skills.plugins.repositories.delete'
        ),
        {
          name: 'Unlink skill plugin repository',
          description: 'Unlinks an SCM repository from a skill plugin.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillPluginRepositoryPresenter)
      .do(async ctx => {
        let skillPluginRepository =
          await skillPluginRepositoryService.deleteSkillPluginRepository({
            ...getSkillPluginAccess(ctx),
            skillPlugin: ctx.skillPlugin,
            skillPluginRepositoryId: ctx.params.skillPluginRepositoryId
          });

        return skillPluginRepositoryPresenter.present({ skillPluginRepository });
      }),

    getEditorUrl: skillPluginGroup
      .post(
        instancePath('skill-plugins/:skillPluginId/editor-url', 'skills.plugins.getEditorUrl'),
        {
          name: 'Get skill plugin editor URL',
          description: 'Creates an embeddable editor URL for a skill plugin.',
          hideInDocs: true
        }
      )
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({}))
      .output(bucketEditorTokenPresenter)
      .do(async ctx => {
        let token = await skillPluginService.getSkillPluginEditorUrl({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin,
          isReadOnly: true
        });

        return bucketEditorTokenPresenter.present({
          token: {
            id: ctx.skillPlugin.backing.id,
            url: token.url,
            expiresAt: token.expiresAt
          }
        });
      })
  }
);
