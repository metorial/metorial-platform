import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { MagicMcpServerStatus } from '@metorial/db';
import {
  consumerAccessService,
  consumerProfileService,
  consumerService
} from '@metorial/module-consumer';
import { magicMcpServerService } from '@metorial/module-magic';
import { subspaceSessionTemplateService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../middleware/requireConsumerTokenForPublishableKey';
import { magicMcpServerPresenter } from '../../presenters';

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
    accessTags: ctx.accessTags
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

export let magicMcpServerController = Controller.create(
  {
    name: 'Magic MCP Servers',
    description:
      'Magic MCP servers are stable MCP entrypoints backed by one Subspace session template.'
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
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())])),
            consumer_profile_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string()),
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
          status: normalizeArrayParam<MagicMcpServerStatus>(ctx.query.status),
          groupIds: normalizeArrayParam(ctx.query.magic_mcp_group_id),
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
        return magicMcpServerPresenter.present({ magicMcpServer: ctx.magicMcpServer });
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
          await consumerAccessService.createConsumerAccess({
            organization: ctx.organization,
            consumerSurface: consumerProfile.surface,
            consumerGroup: consumerProfile.personalConsumerGroup,
            access: {
              type: 'magic_mcp_server',
              magicMcpServer
            }
          });
        }

        return magicMcpServerPresenter.present({ magicMcpServer });
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

        return magicMcpServerPresenter.present({ magicMcpServer });
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
          aliases: v.optional(v.array(v.string())),
          session_template_id: v.optional(v.string())
        })
      )
      .output(magicMcpServerPresenter)
      .use(hasFlags(['magic-mcp-enabled']))
      .use(requireConsumerTokenForPublishableKey())
      .do(async ctx => {
        let sessionTemplateId = ctx.body.session_template_id;
        if (sessionTemplateId && !ctx.accessTags) {
          sessionTemplateId = (
            await subspaceSessionTemplateService.get({
              instance: ctx.instance,
              sessionTemplateId
            })
          ).id;
        }

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
            aliases: ctx.body.aliases,
            sessionTemplateId
          }
        });

        return magicMcpServerPresenter.present({ magicMcpServer });
      })
  }
);
