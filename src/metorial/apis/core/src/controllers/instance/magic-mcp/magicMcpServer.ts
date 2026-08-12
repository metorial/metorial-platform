import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpServerStatus } from '@metorial/db';
import {
  consumerProfileService,
  consumerService,
  grantConsumerOwnedMagicMcpServerAccess
} from '@metorial/module-consumer';
import {
  ensureMagicMcpServerBacking,
  magicMcpServerService,
  type MagicMcpServerOwnerFilter
} from '@metorial/module-magic';
import {
  integrationInstanceService,
  integrationService,
  magicMcpServerBackingService,
  magicMcpServerProviderService
} from '@metorial-subspace/module-integration';
import { sessionService } from '@metorial-subspace/module-session';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import {
  magicMcpServerPresenter,
  magicMcpServerProviderPresenter,
  providerSessionPresenter,
  providerToolsPresenter
} from '@metorial/presenters';
import { normalizeToolFilters, toolFiltersValidator } from '../sessions/_shared';

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
let magicMcpServerOwnerFilterValues = ['organization', 'consumer'] as const;

type RawMagicMcpServerProvider = Awaited<
  ReturnType<typeof magicMcpServerProviderService.getMagicMcpServerProviderById>
>;

let validateLinkedIntegrationInstanceForMagicMcpServer = async (d: {
  instance: Parameters<
    typeof integrationInstanceService.getIntegrationInstanceById
  >[0]['instance'];
  integrationInstanceId: string;
}) => {
  let integrationInstance = await integrationInstanceService.getIntegrationInstanceById({
    instance: d.instance,
    integrationInstanceId: d.integrationInstanceId
  });

  if (integrationInstance.status !== 'active') {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP servers can only be linked to active integration instances.',
        code: 'integration_instance_not_active',
        data: {
          integration_instance_id: integrationInstance.id,
          status: integrationInstance.status
        }
      })
    );
  }

  if (!integrationInstance.integrationInstanceProviders.length) {
    throw new ServiceError(
      badRequestError({
        message:
          'Magic MCP servers require an integration instance with configured providers.',
        code: 'integration_instance_has_no_providers',
        data: {
          integration_instance_id: integrationInstance.id
        }
      })
    );
  }

  return integrationInstance;
};

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
  let magicMcpServer = d.magicMcpServer;
  if (!magicMcpServer.hasSubspaceBacking) {
    let updatedMagicMcpServer = await ensureMagicMcpServerBacking({
      instance: d.instance,
      server: magicMcpServer
    });
    magicMcpServer = {
      ...magicMcpServer,
      ...updatedMagicMcpServer
    };
  }

  if (!magicMcpServer.hasSubspaceBacking) {
    return {
      magicMcpServer,
      portal: d.portal,
      integration: null,
      integrationInstance: null,
      magicMcpServerProviders: []
    };
  }

  let backing = await magicMcpServerBackingService.getMagicMcpServerBackingById({
    instance: d.instance,
    magicMcpServerBackingId: magicMcpServer.id
  });
  let integration =
    (backing.ownerIntegration?.id ?? backing.integration?.id)
      ? await integrationService.getIntegrationById({
          instance: d.instance,
          integrationId: backing.ownerIntegration?.id ?? backing.integration!.id,
          allowDeleted: true
        })
      : null;
  let integrationInstance = await integrationInstanceService.getIntegrationInstanceById({
    instance: d.instance,
    integrationInstanceId: backing.integrationInstance.id,
    allowDeleted: true
  });
  let magicMcpServerProvidersPaginator =
    await magicMcpServerService.listMagicMcpServerProviders({
      server: magicMcpServer,
      instance: d.instance,
      allowDeleted: true
    });
  let magicMcpServerProviders = (await magicMcpServerProvidersPaginator.run({ limit: 100 }))
    .items;

  return {
    magicMcpServer,
    portal: d.portal,
    integration,
    integrationInstance,
    magicMcpServerProviders
  };
};

let getMagicMcpServerListPresentationData = async (d: {
  instance: Parameters<typeof magicMcpServerService.getMagicMcpServerById>[0]['instance'];
  magicMcpServers: Awaited<
    ReturnType<Awaited<ReturnType<typeof magicMcpServerService.listMagicMcpServers>>['run']>
  >['items'];
  portal?: Parameters<typeof magicMcpServerPresenter.present>[0]['portal'];
}) => {
  let presentationData = new Map<
    string,
    Parameters<typeof magicMcpServerPresenter.present>[0]
  >();
  let backedServerIds = d.magicMcpServers
    .filter(magicMcpServer => magicMcpServer.hasSubspaceBacking)
    .map(magicMcpServer => magicMcpServer.id);
  let providersByServerId = new Map<string, RawMagicMcpServerProvider[]>();

  if (backedServerIds.length > 0) {
    let after: string | undefined;

    while (true) {
      let paginator = await magicMcpServerProviderService.listMagicMcpServerProviders({
        instance: d.instance,
        allowDeleted: true,
        magicMcpServerBackingIds: backedServerIds
      });
      let result = await paginator.run({ limit: 100, ...(after ? { after } : {}) });

      for (let provider of result.items) {
        let providers = providersByServerId.get(provider.magicMcpServerBacking.id) ?? [];
        providers.push(provider);
        providersByServerId.set(provider.magicMcpServerBacking.id, providers);
      }

      if (!result.pagination.hasNextPage || result.items.length === 0) break;
      after = result.items[result.items.length - 1]!.id;
    }
  }

  for (let magicMcpServer of d.magicMcpServers) {
    presentationData.set(magicMcpServer.id, {
      magicMcpServer,
      portal: d.portal,
      integration: null,
      integrationInstance: null,
      magicMcpServerProviders: providersByServerId.get(magicMcpServer.id) ?? []
    });
  }

  return presentationData;
};

let magicMcpServerProviderGroup = magicMcpServerGroup.use(async ctx => {
  if (!ctx.params.magicMcpServerProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpServerProviderId is required',
        description: 'The magicMcpServerProviderId path parameter is required.'
      })
    );
  }

  let magicMcpServerProvider = await magicMcpServerService.getMagicMcpServerProviderById({
    server: ctx.magicMcpServer,
    instance: ctx.instance,
    accessTags: ctx.accessTags,
    magicMcpServerProviderId: ctx.params.magicMcpServerProviderId,
    allowDeleted: true
  });

  return { magicMcpServerProvider };
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
            integration_instance_id: v.optional(v.union([v.string(), v.array(v.string())])),
            owner: v.optional(
              v.union([
                v.enumOf([...magicMcpServerOwnerFilterValues]),
                v.array(v.enumOf([...magicMcpServerOwnerFilterValues]))
              ])
            ),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
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
          subspaceIntegrationInstanceIds: normalizeArrayParam(
            ctx.query.integration_instance_id
          ),
          owners: normalizeArrayParam<MagicMcpServerOwnerFilter>(ctx.query.owner),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          ids: normalizeArrayParam(ctx.query.id),
          search: ctx.query.search,
          accessTags: ctx.accessTags,
          preconfiguredOnly: ctx.query.preconfigured_only,
          filterAccessTags
        });

        let list = await paginator.run(ctx.query);
        let presentationData = await getMagicMcpServerListPresentationData({
          instance: ctx.instance,
          magicMcpServers: list.items,
          portal: ctx.portal
        });

        return Paginator.present(list, magicMcpServer =>
          magicMcpServerPresenter.present(presentationData.get(magicMcpServer.id)!)
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

        return providerToolsPresenter.present({
          items: items as unknown as Parameters<
            typeof providerToolsPresenter.present
          >[0]['items']
        });
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
                v.enumOf(['pending', 'active', 'archived', 'deleted']),
                v.array(v.enumOf(['pending', 'active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_instance_provider_id: v.optional(
              v.union([v.string(), v.array(v.string())])
            ),
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
        let paginator = await magicMcpServerService.listMagicMcpServerProviders({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
          integrationInstanceProviderIds: normalizeArrayParam(
            ctx.query.integration_instance_provider_id
          ),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpServerProvider =>
          magicMcpServerProviderPresenter.present({
            magicMcpServer: ctx.magicMcpServer,
            magicMcpServerProvider
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
          description: 'Creates a configurable provider row for a magic MCP server.'
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
        let magicMcpServerProvider = await magicMcpServerService.createMagicMcpServerProvider({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags,
          input: {
            providerId: ctx.body.provider_id,
            providerDeploymentId: ctx.body.provider_deployment_id,
            providerConfigId: ctx.body.provider_config_id,
            providerAuthConfigId: ctx.body.provider_auth_config_id,
            toolFilters:
              ctx.body.tool_filters === undefined
                ? undefined
                : normalizeToolFilters(ctx.body.tool_filters)
          }
        });

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          magicMcpServerProvider
        });
      }),

    getProvider: magicMcpServerProviderGroup
      .get(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers/:magicMcpServerProviderId',
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
          magicMcpServerProvider: ctx.magicMcpServerProvider
        });
      }),

    updateProvider: magicMcpServerProviderGroup
      .patch(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers/:magicMcpServerProviderId',
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
        let magicMcpServerProvider = await magicMcpServerService.updateMagicMcpServerProvider({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags,
          magicMcpServerProviderId: ctx.magicMcpServerProvider.id,
          input: {
            providerDeploymentId: ctx.body.provider_deployment_id,
            providerConfigId: ctx.body.provider_config_id,
            providerAuthConfigId: ctx.body.provider_auth_config_id,
            toolFilters:
              ctx.body.tool_filters === undefined
                ? undefined
                : normalizeToolFilters(ctx.body.tool_filters)
          }
        });

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          magicMcpServerProvider
        });
      }),

    deleteProvider: magicMcpServerProviderGroup
      .delete(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/providers/:magicMcpServerProviderId',
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
        let magicMcpServerProvider = await magicMcpServerService.archiveMagicMcpServerProvider(
          {
            server: ctx.magicMcpServer,
            instance: ctx.instance,
            accessTags: ctx.accessTags,
            magicMcpServerProviderId: ctx.magicMcpServerProvider.id
          }
        );

        return magicMcpServerProviderPresenter.present({
          magicMcpServer: ctx.magicMcpServer,
          magicMcpServerProvider
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
          provider_template_id: v.optional(v.string()),
          integration_instance_id: v.optional(v.string()),
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

        if (ctx.body.provider_template_id && ctx.body.integration_instance_id) {
          throw new ServiceError(
            badRequestError({
              message:
                'provider_template_id and integration_instance_id cannot be specified together.',
              code: 'magic_mcp_server_backing_conflict'
            })
          );
        }

        if (ctx.body.integration_instance_id) {
          await validateLinkedIntegrationInstanceForMagicMcpServer({
            instance: ctx.instance,
            integrationInstanceId: ctx.body.integration_instance_id
          });
        }

        let magicMcpServer = await magicMcpServerService.createMagicMcpServer({
          organization: ctx.organization,
          performedBy: ctx.actor!,
          instance: ctx.instance,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            providerTemplateId: ctx.body.provider_template_id,
            subspaceIntegrationInstanceId: ctx.body.integration_instance_id
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

export let magicMcpServerControllerDashboard = Controller.create(
  {
    name: 'Magic MCP Servers - Dashboard',
    description: 'Endpoints for magic MCP server management within the provider dashboard.',
    hideInDocs: true
  },
  {
    ...magicMcpServerController.handlers,

    createLinkedSession: magicMcpServerGroup
      .post(
        instancePath(
          'magic-mcp-servers/:magicMcpServerId/session',
          'magicMcpServers.session.create'
        ),
        {
          name: 'Create linked magic MCP server session',
          description:
            'Resolves the current internal ephemeral managed session for a magic MCP server and returns it as a dashboard session.'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'deny'
        })
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .output(providerSessionPresenter)
      .do(async ctx => {
        await magicMcpServerService.checkWriteAccess({
          server: ctx.magicMcpServer,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpServer = await ensureMagicMcpServerBacking({
          instance: ctx.instance,
          server: ctx.magicMcpServer
        });
        let backing = await magicMcpServerBackingService.getMagicMcpServerBackingById({
          instance: ctx.instance,
          magicMcpServerBackingId: magicMcpServer.id
        });
        let session = await sessionService.getSessionById({
          instance: ctx.instance,
          sessionId: backing.ephemeralManagedSession.id
        });

        return providerSessionPresenter.present({ session });
      })
  }
);
