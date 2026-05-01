import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpEndpointStatus } from '@metorial/db';
import {
  consumerProfileService,
  grantConsumerOwnedMagicMcpEndpointAccess
} from '@metorial/module-consumer';
import {
  magicMcpEndpointService,
  type MagicMcpEndpointToolFilters
} from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../middleware/requireConsumerTokenForPublishableKey';
import { magicMcpEndpointPresenter } from '../../presenters';
import { toolFiltersValidator } from './session';

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
    accessTags: ctx.accessTags
  });

  return { magicMcpEndpoint };
});

let magicMcpEndpointStatusValues = ['active', 'archived', 'deleted'] as const;
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

export let magicMcpEndpointController = Controller.create(
  {
    name: 'Magic MCP Endpoints',
    description:
      'Magic MCP endpoints combine multiple Magic MCP servers behind one routed connection target.'
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

        let magicMcpEndpoint = await magicMcpEndpointService.createMagicMcpEndpoint({
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            consumerProfile,
            servers: resolveMagicMcpEndpointServers({
              magicMcpServer: ctx.body.magic_mcp_servers
            })
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
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
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
          endpoint: ctx.magicMcpEndpoint,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
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
          possibleScopes: ['instance.provider.session:write'],
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
      .do(async ctx => {
        await magicMcpEndpointService.checkWriteAccess({
          endpoint: ctx.magicMcpEndpoint,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpEndpoint = await magicMcpEndpointService.addServersToEndpoint({
          endpoint: ctx.magicMcpEndpoint,
          servers:
            resolveMagicMcpEndpointServers({
              magicMcpServer: ctx.body.magic_mcp_servers,
              required: true
            }) ?? []
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
          possibleScopes: ['instance.provider.session:write'],
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
      .do(async ctx => {
        await magicMcpEndpointService.checkWriteAccess({
          endpoint: ctx.magicMcpEndpoint,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        let magicMcpEndpoint = await magicMcpEndpointService.removeServersFromEndpoint({
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
