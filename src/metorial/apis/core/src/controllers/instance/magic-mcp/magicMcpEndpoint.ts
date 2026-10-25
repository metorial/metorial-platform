import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpEndpointStatus } from '@metorial/db';
import { grantConsumerOwnedMagicMcpEndpointAccess } from '@metorial/consumer-magic-access';
import { consumerProfileService } from '@metorial/module-consumer-core';
import { skillPluginService } from '@metorial/module-skill-marketplace';
import {
  magicMcpEndpointService,
  magicMcpServerService,
  type MagicMcpEndpointToolFilters
} from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { magicMcpEndpointPresenter } from '@metorial/presenters';
import { toolFiltersValidator } from '../sessions/_shared';
import { getSkillPluginAccess } from '../skills';
import { getOwnershipActor } from '../../../lib/ownershipActor';

export let magicMcpEndpointGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.magicMcpEndpointId) {
    throw new ServiceError(
      badRequestError({
        message: 'magicMcpEndpointId is required',
        description: 'The magicMcpEndpointId path parameter is required.'
      })
    );
  }

  let magicMcpEndpoint = await magicMcpEndpointService.getMagicMcpEndpointById({
    magicMcpEndpointId: ctx.params.magicMcpEndpointId,
    instance: ctx.instance,
    organizationActor: getOwnershipActor(ctx),
    accessTags: ctx.accessTags
  });

  return { magicMcpEndpoint };
});

let magicMcpEndpointStatusValues = ['active', 'archived', 'deleted'] as const;

let enableSkillEditingValidator = v.optional(
  v.boolean({
    description:
      'Expose skill editing tools on this endpoint so the connecting consumer can read and edit the skills they have access to. Only connections authenticated with a magic MCP token bound to a single consumer get the tools; connections using a publishable key do not. Requires skills to be enabled for the instance and consumer skill editing to be allowed for the project. The tools disappear if either is turned off later.'
  })
);

let magicMcpEndpointServerValidator = v.object({
  magic_mcp_server_id: v.string(),
  tool_filters: toolFiltersValidator
});

let resolveMagicMcpEndpointServers = (d: {
  magicMcpServer?: {
    magic_mcp_server_id: string;
    tool_filters?: MagicMcpEndpointToolFilters;
  }[];
  required?: boolean;
}) => {
  if (d.magicMcpServer?.length) {
    return d.magicMcpServer.map(server => ({
      magicMcpServerId: server.magic_mcp_server_id,
      toolFilters: server.tool_filters
    }));
  }

  if (d.required) {
    throw new ServiceError(
      badRequestError({
        message: 'At least one server is required.',
        description:
          'Provide either `magic_mcp_server_ids` or `servers` with at least one entry.'
      })
    );
  }

  return undefined;
};

let requireConsumerOwnedEndpoint = (d: {
  consumerProfile?: { oid: bigint };
  magicMcpEndpoint: { consumerProfileOid: bigint | null };
}) => {
  if (d.consumerProfile && d.magicMcpEndpoint.consumerProfileOid !== d.consumerProfile.oid) {
    throw new ServiceError(notFoundError('magic_mcp.endpoint'));
  }
};

export let magicMcpEndpointController = Controller.create(
  {
    name: 'Magic MCP Endpoints',
    description:
      'Magic MCP endpoints combine multiple Magic MCP servers behind one routed connection target.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('magic-mcp-endpoints', 'magicMcpEndpoints.list'), {
        name: 'List magic MCP endpoints',
        description: 'Returns a paginated list of magic MCP endpoints.'
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
      .outputList(magicMcpEndpointPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            ownership: v.optional(v.enumOf(['shared', 'usable', 'all']), {
              description:
                "Which resources to return under the resource ownership rules. 'shared' returns only resources that aren't owned, 'usable' returns shared resources plus owned resources the caller can use, 'all' returns every resource the caller can see. Defaults to 'shared' when ownership is enforced for the project and 'all' otherwise."
            }),
            status: v.optional(
              v.union([
                v.enumOf([...magicMcpEndpointStatusValues]),
                v.array(v.enumOf([...magicMcpEndpointStatusValues]))
              ])
            ),
            magic_mcp_server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string())
          })
        )
      )
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        let paginator = await magicMcpEndpointService.listMagicMcpEndpoints({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          ownership: ctx.query.ownership,
          status: normalizeArrayParam<MagicMcpEndpointStatus>(ctx.query.status),
          magicMcpServerIds: normalizeArrayParam(ctx.query.magic_mcp_server_id),
          search: ctx.query.search,
          accessTags: ctx.accessTags
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, magicMcpEndpoint =>
          magicMcpEndpointPresenter.present({ magicMcpEndpoint, portal: ctx.portal })
        );
      }),

    get: magicMcpEndpointGroup
      .get(instancePath('magic-mcp-endpoints/:magicMcpEndpointId', 'magicMcpEndpoints.get'), {
        name: 'Get magic MCP endpoint',
        description: 'Retrieves a specific magic MCP endpoint.'
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
      .output(magicMcpEndpointPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .do(async ctx => {
        return magicMcpEndpointPresenter.present({
          magicMcpEndpoint: ctx.magicMcpEndpoint,
          portal: ctx.portal
        });
      }),

    create: instanceGroup
      .post(instancePath('magic-mcp-endpoints', 'magicMcpEndpoints.create'), {
        name: 'Create magic MCP endpoint',
        description: 'Creates a magic MCP endpoint.'
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
          consumer_profile_id: v.optional(v.string()),
          skill_plugin_id: v.optional(v.string()),
          enable_skill_editing: enableSkillEditingValidator,
          magic_mcp_servers: v.optional(v.array(magicMcpEndpointServerValidator))
        })
      )
      .output(magicMcpEndpointPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        if (
          ctx.consumerProfile &&
          ctx.body.consumer_profile_id &&
          ctx.consumerProfile.id !== ctx.body.consumer_profile_id
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'consumer_profile_id does not match authenticated consumer profile',
              description:
                'The consumer_profile_id in the request body does not match the authenticated consumer profile.'
            })
          );
        }

        let consumerProfile =
          ctx.consumerProfile ??
          (ctx.body.consumer_profile_id
            ? await consumerProfileService.getConsumerProfileByIdForInstance({
                instance: ctx.instance,
                consumerProfileId: ctx.body.consumer_profile_id
              })
            : undefined);
        let skillPlugin = ctx.body.skill_plugin_id
          ? await skillPluginService.getSkillPluginById({
              ...(await getSkillPluginAccess(ctx)),
              skillPluginId: ctx.body.skill_plugin_id
            })
          : undefined;
        let servers = resolveMagicMcpEndpointServers({
          magicMcpServer: ctx.body.magic_mcp_servers
        });

        if ((skillPlugin || ctx.consumerProfile) && servers?.length) {
          await Promise.all(
            servers.map(server =>
              magicMcpServerService.getMagicMcpServerById({
                instance: ctx.instance,
                organizationActor: getOwnershipActor(ctx),
                magicMcpServerId: server.magicMcpServerId,
                accessTags: ctx.accessTags,
                consumerSurface: ctx.consumerSurface
              })
            )
          );
        }

        let magicMcpEndpoint = await magicMcpEndpointService.createMagicMcpEndpoint({
          organizationActor: getOwnershipActor(ctx),
          auditScope: ctx.auditScope,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            consumerProfile,
            skillPlugin,
            enableSkillEditing: ctx.body.enable_skill_editing,
            servers
          }
        });

        if (consumerProfile) {
          await grantConsumerOwnedMagicMcpEndpointAccess({
            organization: ctx.organization,
            consumerProfile,
            consumerGroups: ctx.consumerGroups,
            magicMcpEndpoint
          });
        }

        return magicMcpEndpointPresenter.present({
          magicMcpEndpoint,
          portal: ctx.portal
        });
      }),

    delete: magicMcpEndpointGroup
      .delete(
        instancePath('magic-mcp-endpoints/:magicMcpEndpointId', 'magicMcpEndpoints.delete'),
        {
          name: 'Delete magic MCP endpoint',
          description: 'Archives a magic MCP endpoint.'
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
      .output(magicMcpEndpointPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        await magicMcpEndpointService.checkWriteAccess({
          endpoint: ctx.magicMcpEndpoint,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpEndpoint = await magicMcpEndpointService.archiveMagicMcpEndpoint({
          auditScope: ctx.auditScope,
          endpoint: ctx.magicMcpEndpoint
        });

        return magicMcpEndpointPresenter.present({
          magicMcpEndpoint,
          portal: ctx.portal
        });
      }),

    update: magicMcpEndpointGroup
      .patch(
        instancePath('magic-mcp-endpoints/:magicMcpEndpointId', 'magicMcpEndpoints.update'),
        {
          name: 'Update magic MCP endpoint',
          description: 'Updates a magic MCP endpoint.'
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
        'mt_2026_01_01_magnetar',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          enable_skill_editing: enableSkillEditingValidator
        }),
        v => v
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          enable_skill_editing: enableSkillEditingValidator,
          source: v.optional(v.enumOf(['explorer']), {
            description:
              'Mark this resource as originating from the dashboard explorer and enable its owner lock and owner-only visibility.'
          })
        })
      )
      .output(magicMcpEndpointPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        await magicMcpEndpointService.checkWriteAccess({
          endpoint: ctx.magicMcpEndpoint,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpEndpoint = await magicMcpEndpointService.updateMagicMcpEndpoint({
          auditScope: ctx.auditScope,
          endpoint: ctx.magicMcpEndpoint,
          organizationActor: getOwnershipActor(ctx),
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            enableSkillEditing: ctx.body.enable_skill_editing,
            source: ctx.body.source,
            isOwnerLocked: ctx.body.source === 'explorer' ? true : undefined,
            isOwnerOnlyVisible: ctx.body.source === 'explorer' ? true : undefined
          }
        });

        return magicMcpEndpointPresenter.present({
          magicMcpEndpoint,
          portal: ctx.portal
        });
      }),

    addServers: magicMcpEndpointGroup
      .post(
        instancePath(
          'magic-mcp-endpoints/:magicMcpEndpointId/add-servers',
          'magicMcpEndpoints.addServers'
        ),
        {
          name: 'Add servers to magic MCP endpoint',
          description: 'Adds magic MCP servers to a magic MCP endpoint.'
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
          magic_mcp_servers: v.optional(v.array(magicMcpEndpointServerValidator))
        })
      )
      .output(magicMcpEndpointPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        requireConsumerOwnedEndpoint({
          consumerProfile: ctx.consumerProfile,
          magicMcpEndpoint: ctx.magicMcpEndpoint
        });
        await magicMcpEndpointService.checkWriteAccess({
          endpoint: ctx.magicMcpEndpoint,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let servers =
          resolveMagicMcpEndpointServers({
            magicMcpServer: ctx.body.magic_mcp_servers,
            required: true
          }) ?? [];

        if (ctx.consumerProfile) {
          await Promise.all(
            servers.map(server =>
              magicMcpServerService.getMagicMcpServerById({
                instance: ctx.instance,
                organizationActor: getOwnershipActor(ctx),
                magicMcpServerId: server.magicMcpServerId,
                accessTags: ctx.accessTags,
                consumerSurface: ctx.consumerSurface
              })
            )
          );
        }

        let magicMcpEndpoint = await magicMcpEndpointService.addServersToEndpoint({
          organizationActor: getOwnershipActor(ctx),
          auditScope: ctx.auditScope,
          endpoint: ctx.magicMcpEndpoint,
          servers
        });

        return magicMcpEndpointPresenter.present({
          magicMcpEndpoint,
          portal: ctx.portal
        });
      }),

    removeServers: magicMcpEndpointGroup
      .post(
        instancePath(
          'magic-mcp-endpoints/:magicMcpEndpointId/remove-servers',
          'magicMcpEndpoints.removeServers'
        ),
        {
          name: 'Remove servers from magic MCP endpoint',
          description: 'Removes magic MCP servers from a magic MCP endpoint.'
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
          magic_mcp_server_ids: v.array(v.string())
        })
      )
      .output(magicMcpEndpointPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        requireConsumerOwnedEndpoint({
          consumerProfile: ctx.consumerProfile,
          magicMcpEndpoint: ctx.magicMcpEndpoint
        });
        await magicMcpEndpointService.checkWriteAccess({
          endpoint: ctx.magicMcpEndpoint,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpEndpoint = await magicMcpEndpointService.removeServersFromEndpoint({
          auditScope: ctx.auditScope,
          endpoint: ctx.magicMcpEndpoint,
          magicMcpServerIds: ctx.body.magic_mcp_server_ids
        });

        return magicMcpEndpointPresenter.present({
          magicMcpEndpoint,
          portal: ctx.portal
        });
      })
  }
);
