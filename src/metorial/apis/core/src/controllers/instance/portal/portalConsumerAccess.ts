import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillService } from '@metorial/module-skill';
import { skillGroupService } from '@metorial/module-skill-groups';
import { skillPluginService } from '@metorial/module-skill-marketplace';
import { skillTemplateService } from '@metorial/module-skill-templates';
import { db } from '@metorial/db';
import { consumerAccessService } from '@metorial/module-consumer-access';
import { consumerGroupService } from '@metorial/module-consumer-core';
import { magicMcpServerService, providerTemplateService } from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { getVisibleConsumerGroups } from '../../../lib/visibleConsumerGroups';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { consumerAccessPresenter } from '@metorial/presenters';
import { portalGroup } from './portal';

export let consumerAccessGroup = portalGroup.use(async ctx => {
  if (!ctx.params.accessId) {
    throw new ServiceError(
      badRequestError({
        message: 'accessId is required',
        description: 'The accessId path parameter is required.'
      })
    );
  }

  let consumerAccess = await consumerAccessService.getConsumerAccessById({
    consumerSurface: ctx.portal.surface,
    consumerAccessId: ctx.params.accessId,
    visibleToConsumerGroups: getVisibleConsumerGroups(ctx)
  });

  return { consumerAccess };
});

export let portalConsumerAccessController = Controller.create(
  {
    name: 'Portal Access',
    description:
      'A portal access rule grants one consumer group access to one listing target, such as an integration, skill, or skill set.'
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/access', 'portals.access.list'), {
        name: 'List portal access',
        description: 'Returns a paginated list of consumer access rules for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(consumerAccessPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string({ description: 'Search by name or description.' })),
            consumer_group_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules for these consumer groups.' }
            ),
            provider_template_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules for these provider templates.' }
            ),
            magic_mcp_server_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules for these magic MCP servers.' }
            ),
            skill_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return rules for these skills.'
            }),
            skill_template_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules for these skill templates.' }
            ),
            skill_group_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules for these skill groups.' }
            ),
            skill_marketplace_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules for these skill marketplaces.' }
            ),
            skill_plugin_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules for these skill plugins.' }
            ),
            consumer_access_listing_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Only return rules attached to these listings.' }
            ),
            type: v.optional(
              v.union(
                [
                  v.enumOf([
                    'provider_template',
                    'magic_mcp_server',
                    'skill',
                    'skill_template',
                    'skill_group',
                    'skill_marketplace',
                    'skill_plugin'
                  ]),
                  v.array(
                    v.enumOf([
                      'provider_template',
                      'magic_mcp_server',
                      'skill',
                      'skill_template',
                      'skill_group',
                      'skill_marketplace',
                      'skill_plugin'
                    ])
                  )
                ],
                { description: 'Only return rules of these types.' }
              )
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerAccessService.listConsumerAccesses({
          consumerSurface: ctx.portal.surface,
          consumerGroupIds: normalizeArrayParam(ctx.query.consumer_group_id),
          providerTemplateIds: normalizeArrayParam(ctx.query.provider_template_id),
          magicMcpServerIds: normalizeArrayParam(ctx.query.magic_mcp_server_id),
          skillIds: normalizeArrayParam(ctx.query.skill_id),
          skillTemplateIds: normalizeArrayParam(ctx.query.skill_template_id),
          skillGroupIds: normalizeArrayParam(ctx.query.skill_group_id),
          skillMarketplaceIds: normalizeArrayParam(ctx.query.skill_marketplace_id),
          skillPluginIds: normalizeArrayParam(ctx.query.skill_plugin_id),
          consumerAccessListingIds: normalizeArrayParam(ctx.query.consumer_access_listing_id),
          types: normalizeArrayParam(ctx.query.type),
          search: ctx.query.search,
          visibleToConsumerGroups: getVisibleConsumerGroups(ctx)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAccess =>
          consumerAccessPresenter.present({ consumerAccess })
        );
      }),

    get: consumerAccessGroup
      .get(instancePath('portals/:portalId/access/:accessId', 'portals.access.get'), {
        name: 'Get portal access',
        description: 'Retrieves a portal access rule.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessPresenter)
      .do(async ctx => {
        return consumerAccessPresenter.present({
          consumerAccess: ctx.consumerAccess
        });
      }),

    create: portalGroup
      .post(instancePath('portals/:portalId/access', 'portals.access.create'), {
        name: 'Create portal access',
        description: 'Creates a consumer access rule for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          consumer_group_id: v.string({
            description: 'Consumer group the rule grants access to.'
          }),
          name: v.optional(v.string({ description: 'Display name.' })),
          description: v.optional(
            v.nullable(v.string({ description: 'Free-text description.' }))
          ),
          readme: v.optional(
            v.nullable(v.string({ description: 'Longer guide shown to consumers.' }))
          ),
          access: v.union(
            [
              v.object({
                type: v.literal('provider_template'),
                provider_template_id: v.string({
                  description: 'Provider template the rule grants access to.'
                })
              }),
              v.object({
                type: v.literal('magic_mcp_server'),
                magic_mcp_server_id: v.string({
                  description: 'Magic MCP server the rule grants access to.'
                })
              }),
              v.object({
                type: v.literal('skill'),
                skill_id: v.string({ description: 'Skill the rule grants access to.' }),
                permission: v.optional(
                  v.enumOf(['read', 'write', 'manage'], {
                    description: 'What the group can do with the skill.'
                  })
                )
              }),
              v.object({
                type: v.literal('skill_template'),
                skill_template_id: v.string({
                  description: 'Skill template the rule grants access to.'
                })
              }),
              v.object({
                type: v.literal('skill_group'),
                skill_group_id: v.string({
                  description: 'Skill group the rule grants access to.'
                }),
                permission: v.optional(
                  v.enumOf(['read', 'write', 'manage'], {
                    description: 'What the group can do with the skill group.'
                  })
                )
              }),
              v.object({
                type: v.literal('skill_marketplace'),
                skill_marketplace_id: v.string({
                  description: 'Skill marketplace the rule grants access to.'
                }),
                permission: v.optional(
                  v.enumOf(['read', 'manage'], {
                    description: 'What the group can do with the skill marketplace.'
                  })
                )
              }),
              v.object({
                type: v.literal('skill_plugin'),
                skill_marketplace_id: v.string({
                  description: 'Skill marketplace the plugin is published in.'
                }),
                skill_plugin_id: v.string({
                  description: 'Skill plugin the rule grants access to.'
                })
              })
            ],
            { description: 'The integration, skill, or skill set the rule grants access to.' }
          )
        })
      )
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerGroup = await consumerGroupService.getConsumerGroupById({
          consumerSurface: ctx.portal.surface,
          consumerGroupId: ctx.body.consumer_group_id,
          types: ['default', 'user_access']
        });

        let access = ctx.body.access;
        let input = {
          name: ctx.body.name,
          description: ctx.body.description,
          readme: ctx.body.readme
        };
        let localSkill = null;
        let localSkillTemplate = null;
        let localSkillGroup = null;
        let localSkillMarketplace = null;
        let localSkillPlugin = null;
        let cargoAccess = await getInstanceCargoAccess(ctx);

        if (access.type == 'skill') {
          localSkill = await skillService.getSkillById({
            project: cargoAccess.project,
            instance: cargoAccess.instance,
            skillId: access.skill_id,
            allowDeleted: true
          });
        }

        if (access.type == 'skill_template') {
          localSkillTemplate = await skillTemplateService.getSkillTemplateById({
            project: cargoAccess.project,
            instance: cargoAccess.instance,
            skillTemplateId: access.skill_template_id
          });
        }

        if (access.type == 'skill_group') {
          localSkillGroup = await skillGroupService.getSkillGroupById({
            project: cargoAccess.project,
            instance: cargoAccess.instance,
            skillGroupId: access.skill_group_id,
            allowDeleted: true
          });
        }
        if (access.type == 'skill_marketplace' || access.type == 'skill_plugin') {
          localSkillMarketplace = await db.skillMarketplace.findFirst({
            where: {
              instanceOid: ctx.instance.oid,
              id: access.skill_marketplace_id,
              status: { not: 'deleted' }
            }
          });
          if (!localSkillMarketplace) {
            throw new ServiceError(notFoundError('skill.marketplace'));
          }
        }
        if (access.type == 'skill_plugin') {
          localSkillPlugin = await skillPluginService.getSkillPluginById({
            project: cargoAccess.project,
            instance: cargoAccess.instance,
            skillPluginId: access.skill_plugin_id
          });
          let marketplacePlugin = await db.skillMarketplacePlugin.findFirst({
            where: {
              skillMarketplaceOid: localSkillMarketplace!.oid,
              skillPluginOid: localSkillPlugin.oid,
              status: 'active'
            },
            select: {
              oid: true
            }
          });
          if (!marketplacePlugin) {
            throw new ServiceError(notFoundError('skill.plugin'));
          }
        }
        let consumerAccess =
          access.type == 'provider_template'
            ? await consumerAccessService.createConsumerAccess({
                organization: ctx.organization,
                consumerSurface: ctx.portal.surface,
                auditScope: ctx.auditScope,
                consumerGroup,
                input,
                access: {
                  type: 'provider_template',
                  providerTemplate: await providerTemplateService.getProviderTemplateById({
                    instance: ctx.instance,
                    providerTemplateId: access.provider_template_id
                  })
                }
              })
            : access.type == 'magic_mcp_server'
              ? await consumerAccessService.createConsumerAccess({
                  organization: ctx.organization,
                  consumerSurface: ctx.portal.surface,
                  auditScope: ctx.auditScope,
                  consumerGroup,
                  input,
                  access: {
                    type: 'magic_mcp_server',
                    magicMcpServer: await magicMcpServerService.getMagicMcpServerById({
                      instance: ctx.instance,
                      magicMcpServerId: access.magic_mcp_server_id
                    })
                  }
                })
              : access.type == 'skill'
                ? await consumerAccessService.createConsumerAccess({
                    organization: ctx.organization,
                    consumerSurface: ctx.portal.surface,
                    auditScope: ctx.auditScope,
                    consumerGroup,
                    input,
                    access: {
                      type: 'skill',
                      skill: localSkill!,
                      accessLevel: access.permission
                    }
                  })
                : access.type == 'skill_template'
                  ? await consumerAccessService.createConsumerAccess({
                      organization: ctx.organization,
                      consumerSurface: ctx.portal.surface,
                      auditScope: ctx.auditScope,
                      consumerGroup,
                      input,
                      access: {
                        type: 'skill_template',
                        skillTemplate: localSkillTemplate!
                      }
                    })
                  : access.type == 'skill_group'
                    ? await consumerAccessService.createConsumerAccess({
                        organization: ctx.organization,
                        consumerSurface: ctx.portal.surface,
                        auditScope: ctx.auditScope,
                        consumerGroup,
                        input,
                        access: {
                          type: 'skill_group',
                          skillGroup: localSkillGroup!,
                          accessLevel: access.permission
                        }
                      })
                    : access.type == 'skill_plugin'
                      ? await consumerAccessService.createConsumerAccess({
                          organization: ctx.organization,
                          consumerSurface: ctx.portal.surface,
                          auditScope: ctx.auditScope,
                          consumerGroup,
                          input,
                          access: {
                            type: 'skill_plugin',
                            skillPlugin: localSkillPlugin!,
                            skillMarketplace: localSkillMarketplace!
                          }
                        })
                      : await consumerAccessService.createConsumerAccess({
                          organization: ctx.organization,
                          consumerSurface: ctx.portal.surface,
                          auditScope: ctx.auditScope,
                          consumerGroup,
                          input,
                          access: {
                            type: 'skill_marketplace',
                            skillMarketplace: localSkillMarketplace!,
                            accessLevel: access.permission == 'manage' ? 'manage' : 'read'
                          }
                        });

        return consumerAccessPresenter.present({ consumerAccess });
      }),

    update: consumerAccessGroup
      .patch(instancePath('portals/:portalId/access/:accessId', 'portals.access.update'), {
        name: 'Update portal access',
        description:
          'Updates a portal access rule. Only skill and skill group rules use `permission`. Omitted fields keep their current value.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'Display name.' })),
          description: v.optional(
            v.nullable(v.string({ description: 'Free-text description.' }))
          ),
          readme: v.optional(
            v.nullable(v.string({ description: 'Longer guide shown to consumers.' }))
          ),
          permission: v.optional(
            v.enumOf(['read', 'write', 'manage'], {
              description: 'What the group can do with the skill or skill group.'
            })
          )
        })
      )
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerAccess = await consumerAccessService.updateConsumerAccess({
          consumerAccess: ctx.consumerAccess,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            readme: ctx.body.readme,
            accessLevel: ctx.body.permission
          }
        });

        return consumerAccessPresenter.present({ consumerAccess });
      }),

    delete: consumerAccessGroup
      .delete(instancePath('portals/:portalId/access/:accessId', 'portals.access.delete'), {
        name: 'Delete portal access',
        description: 'Deletes a portal access rule.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessPresenter)
      .do(async ctx => {
        let consumerAccess = await consumerAccessService.deleteConsumerAccess({
          organization: ctx.organization,
          consumerAccess: ctx.consumerAccess,
          auditScope: ctx.auditScope
        });

        return consumerAccessPresenter.present({ consumerAccess });
      })
  }
);
