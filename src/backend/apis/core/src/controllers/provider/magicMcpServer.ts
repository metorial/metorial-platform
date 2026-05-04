import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpServerStatus } from '@metorial/db';
import {
  consumerProfileService,
  consumerService,
  grantConsumerOwnedMagicMcpServerAccess
} from '@metorial/module-consumer';
import { magicMcpServerService } from '@metorial/module-magic';
import {
  subspaceIntegrationInstanceProviderService,
  subspaceIntegrationInstanceService,
  subspaceIntegrationProviderService,
  subspaceIntegrationService,
  subspaceMagicMcpBackingService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../middleware/requireConsumerTokenForPublishableKey';
import {
  magicMcpServerPresenter,
  magicMcpServerProviderPresenter,
  providerToolsPresenter
} from '../../presenters';
import { toolFiltersValidator } from './session';

export let magicMcpServerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpServerId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpServerId is required',
        description: 'The magicMcpServerId path parameter is required.'
      })
    );
  }

  let magicMcpServer = await magicMcpServerService.getMagicMcpServerById({
    magicMcpServerId: ctx.params.magicMcpServerId,
    instance: ctx.instance,
    accessTags: ctx.accessTags,
    consumerSurface: ctx.consumerSurface
  });

  return { magicMcpServer };
});

let magicMcpServerStatusValues = ['active', 'archived', 'deleted'] as const;

let getAccessTagsForConsumerProfiles = async (d: {
  consumerProfiles: Awaited<
    ReturnType<typeof consumerProfileService.getConsumerProfileById>
  >[];
}) => {
  if (!d.consumerProfiles.length) {
    return [];
  }

  let accessTags = new Map<bigint, { accessTagOid: bigint }>();
  let consumerProfilesBySurfaceId = new Map<string, typeof d.consumerProfiles>();

  for (let consumerProfile of d.consumerProfiles) {
    accessTags.set(consumerProfile.accessTagOid, {
      accessTagOid: consumerProfile.accessTagOid
    });

    let current = consumerProfilesBySurfaceId.get(consumerProfile.surface.id) ?? [];
    current.push(consumerProfile);
    consumerProfilesBySurfaceId.set(consumerProfile.surface.id, current);
  }

  for (let consumerProfiles of consumerProfilesBySurfaceId.values()) {
    let consumerSurface = consumerProfiles[0].surface; // Profiles are grouped by surface, so we can take the surface from the first profile

    let groupsByProfileId = await consumerProfileService.getStoredGroupsForProfiles({
      consumerSurface,
      consumerProfiles
    });

    for (let consumerProfile of consumerProfiles) {
      for (let group of groupsByProfileId[consumerProfile.id] ?? []) {
        accessTags.set(group.accessTagOid, {
          accessTagOid: group.accessTagOid
        });
      }
    }
  }

  return [...accessTags.values()];
};

let getConsumerFilterAccessTags = async (d: {
  instance: Parameters<typeof magicMcpServerService.listMagicMcpServers>[0]['instance'];
  consumerIds?: string[];
  consumerProfileIds?: string[];
}) => {
  if (!d.consumerIds?.length && !d.consumerProfileIds?.length) return undefined;

  let profileIds = new Set([...(d.consumerProfileIds ?? [])]);

  if (d.consumerIds?.length) {
    let consumers = await consumerService.findConsumersById({
      instance: d.instance,
      consumerIds: d.consumerIds
    });

    for (let consumer of consumers) {
      for (let consumerProfile of consumer.consumer.profiles) {
        profileIds.add(consumerProfile.id);
      }
    }
  }

  if (!profileIds.size) {
    return await getAccessTagsForConsumerProfiles({
      consumerProfiles: []
    });
  }

  let consumerProfiles = await consumerProfileService.findConsumerProfilesByIdForInstance({
    instance: d.instance,
    consumerProfileIds: [...profileIds]
  });

  return await getAccessTagsForConsumerProfiles({
    consumerProfiles
  });
};

let getMagicMcpServerPresentationData = async (d: {
  instance: Parameters<typeof magicMcpServerService.getMagicMcpServerById>[0]['instance'];
  magicMcpServer: Awaited<ReturnType<typeof magicMcpServerService.getMagicMcpServerById>>;
  portal?: Parameters<typeof magicMcpServerPresenter.present>[0]['portal'];
}) => {
  if (!d.magicMcpServer.hasSubspaceBacking) {
    return {
      magicMcpServer: d.magicMcpServer,
      portal: d.portal,
      integration: null,
      integrationInstance: null,
      integrationInstanceProviders: [],
      sessionTemplateId: d.magicMcpServer.subspaceSessionTemplateId
    };
  }

  let backing = await subspaceMagicMcpBackingService.getServer({
    instance: d.instance,
    magicMcpServerBackingId: d.magicMcpServer.id
  });
  let integration = backing.integrationId
    ? await subspaceIntegrationService.get({
        instance: d.instance,
        integrationId: backing.integrationId,
        allowDeleted: true
      })
    : null;
  let integrationInstance = await subspaceIntegrationInstanceService.get({
    instance: d.instance,
    integrationInstanceId: backing.integrationInstanceId,
    allowDeleted: true
  });
  let integrationInstanceProvidersPaginator =
    await subspaceIntegrationInstanceProviderService.list({
      instance: d.instance,
      includeMagicMcpBackings: true,
      allowDeleted: true,
      integrationInstanceIds: [backing.integrationInstanceId]
    });
  let integrationInstanceProviders = (
    await integrationInstanceProvidersPaginator.run({ limit: 100 })
  ).items;

  return {
    magicMcpServer: d.magicMcpServer,
    portal: d.portal,
    integration,
    integrationInstance,
    integrationInstanceProviders,
    sessionTemplateId: backing.sessionTemplateId
  };
};

let getMagicMcpServerBacking = async (d: {
  instance: Parameters<typeof magicMcpServerService.getMagicMcpServerById>[0]['instance'];
  magicMcpServer: Awaited<ReturnType<typeof magicMcpServerService.getMagicMcpServerById>>;
}) =>
  await subspaceMagicMcpBackingService.getServer({
    instance: d.instance,
    magicMcpServerBackingId: d.magicMcpServer.id
  });

let assertMagicMcpServerProviderWriteAllowed = (magicMcpServer: {
  providerTemplateId: string | null;
}) => {
  if (!magicMcpServer.providerTemplateId) return;

  throw new ServiceError(
    badRequestError({
      message:
        'This magic MCP server inherits its integration from a provider template and its providers cannot be changed.',
      code: 'magic_mcp_server_provider_inherited'
    })
  );
};

let magicMcpServerInstanceProviderGroup = magicMcpServerGroup.use(async ctx => {
  if (!ctx.params.integrationInstanceProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationInstanceProviderId is required',
        description: 'The integrationInstanceProviderId path parameter is required.'
      })
    );
  }

  let integrationInstanceProvider = await subspaceIntegrationInstanceProviderService.get({
    instance: ctx.instance,
    integrationInstanceProviderId: ctx.params.integrationInstanceProviderId,
    allowDeleted: true
  });
  let backing = await getMagicMcpServerBacking({
    instance: ctx.instance,
    magicMcpServer: ctx.magicMcpServer
  });

  if (integrationInstanceProvider.integrationInstanceId !== backing.integrationInstanceId) {
    throw new ServiceError(notFoundError('integration.instance.provider'));
  }

  return { integrationInstanceProvider, magicMcpServerBacking: backing };
});

let magicMcpServerIntegrationProviderGroup = magicMcpServerGroup.use(async ctx => {
  if (!ctx.params.integrationProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationProviderId is required',
        description: 'The integrationProviderId path parameter is required.'
      })
    );
  }

  let integrationProvider = await subspaceIntegrationProviderService.get({
    instance: ctx.instance,
    integrationProviderId: ctx.params.integrationProviderId,
    allowDeleted: true
  });
  let backing = await getMagicMcpServerBacking({
    instance: ctx.instance,
    magicMcpServer: ctx.magicMcpServer
  });

  if (integrationProvider.integrationId !== backing.integrationId) {
    throw new ServiceError(notFoundError('integration.provider'));
  }

  return { integrationProvider, magicMcpServerBacking: backing };
});

export let magicMcpServerController = Controller.create(
  {
    name: 'Magic MCP Servers',
    description:
      'Magic MCP servers are stable MCP entrypoints backed by one Subspace session template.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-servers', 'magicMcpServers.list'), {
        name: 'List magic MCP servers',
        description: 'Returns a paginated list of magic MCP servers.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(magicMcpServerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf([...magicMcpServerStatusValues]),
                v.array(v.enumOf([...magicMcpServerStatusValues]))
              ])
            ),
            magic_mcp_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_template_id: v.optional(v.union([v.string(), v.array(v.string())])),
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())])),
            consumer_profile_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string()),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            preconfigured_only: v.optional(v.boolean())
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let filterAccessTags = await getConsumerFilterAccessTags({
          instance: ctx.instance,
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),
          consumerProfileIds: normalizeArrayParam(ctx.query.consumer_profile_id)
        });

        let paginator = await magicMcpServerService.listMagicMcpServers({
          instance: ctx.instance,
          consumerSurface: ctx.consumerSurface,
          status: normalizeArrayParam<MagicMcpServerStatus>(ctx.query.status),
          groupIds: normalizeArrayParam(ctx.query.magic_mcp_group_id),
          providerTemplateIds: normalizeArrayParam(ctx.query.provider_template_id),
          ids: normalizeArrayParam(ctx.query.id),
          search: ctx.query.search,
          accessTags: ctx.accessTags,
          preconfiguredOnly: ctx.query.preconfigured_only,
          filterAccessTags
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpServer =>
          magicMcpServerPresenter.present({ magicMcpServer })
        );
      }),

    get: magicMcpServerGroup
      .get(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.get'), {
        name: 'Get magic MCP server',
        description: 'Retrieves a specific magic MCP server.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpServerPresenter.present(
          await getMagicMcpServerPresentationData({
            instance: ctx.instance,
            magicMcpServer: ctx.magicMcpServer,
            portal: ctx.portal
          })
        );
      }),

    listTools: magicMcpServerGroup
      .get(
        instancePath('magic-mcp-servers/:magicMcpServerId/tools', 'magicMcpServers.tools'),
        {
          name: 'List magic MCP server tools',
          description:
            'Returns the effective set of tools available through the providers backing a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(providerToolsPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let items = await magicMcpServerService.listMagicMcpServerTools({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        return providerToolsPresenter.present({ items });
      }),

    listProviders: magicMcpServerGroup
      .get(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers',
          'magicMcpServers.providers.list'
        ),
        {
          name: 'List magic MCP server providers',
          description:
            'Returns the backing integration instance providers configured for a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(magicMcpServerProviderPresenter)
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
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('magic MCP server provider creation time'),
            updated_at: dateFilterValidator('magic MCP server provider last update time')
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let backing = await getMagicMcpServerBacking({
          instance: ctx.instance,
          magicMcpServer: ctx.magicMcpServer
        });

        let paginator = await subspaceIntegrationInstanceProviderService.list({
          instance: ctx.instance,
          includeMagicMcpBackings: true,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          integrationInstanceIds: [backing.integrationInstanceId],
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, integrationInstanceProvider =>
          magicMcpServerProviderPresenter.present({
            magicMcpServer: ctx.magicMcpServer,
            integrationInstanceProvider
          })
        );
      }),

    createProvider: magicMcpServerGroup
      .post(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers',
          'magicMcpServers.providers.create'
        ),
        {
          name: 'Create magic MCP server provider',
          description:
            'Creates a backing integration provider and then sets the corresponding integration instance provider for a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          provider_id: v.string(),
          provider_deployment_id: v.string(),
          provider_config_id: v.optional(v.nullable(v.string())),
          provider_auth_config_id: v.optional(v.nullable(v.string())),
          tool_filters: toolFiltersValidator
        })
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerProviderPresenter)
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });
        assertMagicMcpServerProviderWriteAllowed(ctx.magicMcpServer);

        let backing = await getMagicMcpServerBacking({
          instance: ctx.instance,
          magicMcpServer: ctx.magicMcpServer
        });
        let integration = backing.integrationId
          ? await subspaceIntegrationService.get({
              instance: ctx.instance,
              integrationId: backing.integrationId,
              allowDeleted: true
            })
          : null;
        if (!integration) {
          throw new ServiceError(notFoundError('integration'));
        }

        let integrationProvider = await subspaceIntegrationProviderService.create({
          instance: ctx.instance,
          integrationId: integration.id,
          providerId: ctx.body.provider_id,
          providerDeploymentId: ctx.body.provider_deployment_id,
          providerConfigId: ctx.body.provider_config_id,
          toolFilters: ctx.body.tool_filters
        });

        let integrationInstanceProvider = await subspaceIntegrationInstanceProviderService.set(
          {
            instance: ctx.instance,
            integrationInstanceId: backing.integrationInstanceId,
            providerId: integrationProvider.id,
            providerAuthConfigId: ctx.body.provider_auth_config_id ?? undefined,
            toolFilters: ctx.body.tool_filters
          }
        );

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          integrationInstanceProvider
        });
      }),

    getProvider: magicMcpServerInstanceProviderGroup
      .get(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers/:integrationInstanceProviderId',
          'magicMcpServers.providers.get'
        ),
        {
          name: 'Get magic MCP server provider',
          description:
            'Retrieves a specific backing integration instance provider for a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:read',
            'consumer#instance.magic_mcp:read'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .use(hasFlags(['magic-mcp-enabled']))
      .output(magicMcpServerProviderPresenter)
      .do(async ctx => {
        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          integrationInstanceProvider: ctx.integrationInstanceProvider
        });
      }),

    updateProvider: magicMcpServerIntegrationProviderGroup
      .patch(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers/:integrationProviderId',
          'magicMcpServers.providers.update'
        ),
        {
          name: 'Update magic MCP server provider',
          description:
            'Updates a backing integration provider and then sets the corresponding integration instance provider for a magic MCP server.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          provider_deployment_id: v.optional(v.string()),
          provider_config_id: v.optional(v.nullable(v.string())),
          provider_auth_config_id: v.optional(v.nullable(v.string())),
          tool_filters: toolFiltersValidator
        })
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerProviderPresenter)
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });
        assertMagicMcpServerProviderWriteAllowed(ctx.magicMcpServer);

        let integrationProvider = await subspaceIntegrationProviderService.update({
          instance: ctx.instance,
          integrationProviderId: ctx.integrationProvider.id,
          allowDeleted: true,
          providerDeploymentId: ctx.body.provider_deployment_id,
          providerConfigId: ctx.body.provider_config_id,
          toolFilters: ctx.body.tool_filters
        });

        let integrationInstanceProvider = await subspaceIntegrationInstanceProviderService.set(
          {
            instance: ctx.instance,
            integrationInstanceId: ctx.magicMcpServerBacking.integrationInstanceId,
            providerId: integrationProvider.id,
            providerAuthConfigId: ctx.body.provider_auth_config_id ?? undefined,
            toolFilters: ctx.body.tool_filters
          }
        );

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          integrationInstanceProvider
        });
      }),

    deleteProvider: magicMcpServerInstanceProviderGroup
      .delete(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers/:integrationInstanceProviderId',
          'magicMcpServers.providers.delete'
        ),
        {
          name: 'Delete magic MCP server provider',
          description:
            'Archives a backing integration instance provider from a magic MCP server and removes the shared integration provider when unused.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .output(magicMcpServerProviderPresenter)
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });
        assertMagicMcpServerProviderWriteAllowed(ctx.magicMcpServer);

        let deletedIntegrationInstanceProvider =
          await subspaceIntegrationInstanceProviderService.delete({
            instance: ctx.instance,
            integrationInstanceProviderId: ctx.integrationInstanceProvider.id,
            allowDeleted: true
          });

        let remainingPaginator = await subspaceIntegrationInstanceProviderService.list({
          instance: ctx.instance,
          includeMagicMcpBackings: true,
          allowDeleted: true,
          status: ['active'],
          integrationInstanceIds: [ctx.magicMcpServerBacking.integrationInstanceId],
          integrationProviderIds: [ctx.integrationInstanceProvider.integrationProviderId]
        });
        let remainingProviders = await remainingPaginator.run({ limit: 1 });

        if (remainingProviders.items.length === 0) {
          await subspaceIntegrationProviderService.delete({
            instance: ctx.instance,
            integrationProviderId: ctx.integrationInstanceProvider.integrationProviderId,
            allowDeleted: true
          });
        }

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          integrationInstanceProvider: deletedIntegrationInstanceProvider
        });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-servers', 'magicMcpServers.create'), {
        name: 'Create magic MCP server',
        description:
          'Creates a magic MCP server with a new session template. A Subspace session is created automatically on first connection and then reused.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          consumer_profile_id: v.optional(v.string())
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        let consumerProfile = ctx.body.consumer_profile_id
          ? await consumerProfileService.getConsumerProfileByIdForInstance({
              instance: ctx.instance,
              consumerProfileId: ctx.body.consumer_profile_id
            })
          : undefined;

        let magicMcpServer = await magicMcpServerService.createMagicMcpServer({
          organization: ctx.organization,
          performedBy: ctx.actor!,
          instance: ctx.instance,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        if (consumerProfile) {
          await grantConsumerOwnedMagicMcpServerAccess({
            organization: ctx.organization,
            consumerProfile,
            magicMcpServer
          });
        }

        return magicMcpServerPresenter.present(
          await getMagicMcpServerPresentationData({
            instance: ctx.instance,
            magicMcpServer,
            portal: ctx.portal
          })
        );
      }),

    delete: magicMcpServerGroup
      .delete(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.delete'), {
        name: 'Delete magic MCP server',
        description: 'Archives a magic MCP server.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpServer = await magicMcpServerService.archiveMagicMcpServer({
          server: ctx.magicMcpServer
        });

        return magicMcpServerPresenter.present(
          await getMagicMcpServerPresentationData({
            instance: ctx.instance,
            magicMcpServer,
            portal: ctx.portal
          })
        );
      }),

    update: magicMcpServerGroup
      .patch(instancePath('magic-mcp-servers/:magicMcpServerId', 'magicMcpServers.update'), {
        name: 'Update magic MCP server',
        description: 'Updates a magic MCP server.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.session:write',
            'consumer#instance.magic_mcp:write'
          ],
          fineGrainedPolicy: 'deny'
        })
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          aliases: v.optional(v.array(v.string()))
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpServer = await magicMcpServerService.updateMagicMcpServer({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            aliases: ctx.body.aliases
          }
        });

        return magicMcpServerPresenter.present(
          await getMagicMcpServerPresentationData({
            instance: ctx.instance,
            magicMcpServer,
            portal: ctx.portal
          })
        );
      })
  }
);
