import {
  badRequestError,
  conflictError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  ConsumerProfile,
  db,
  ID,
  Instance,
  MagicMcpEndpoint,
  MagicMcpEndpointStatus,
  Prisma
} from '@metorial/db';
import { generatePlainId } from '@metorial/id';
import {
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
import {
  magicMcpEndpointCreatedQueue,
  magicMcpEndpointDeletedQueue,
  magicMcpEndpointUpdatedQueue
} from '../queues/lifecycle/magicMcpEndpoint';
import { getAccessTagFilter, getActiveStatusFilter } from './consumerAccess';
import { ensureMagicMcpServerBacking } from './magicMcpServer';

let buildSlug = (name?: string | null) => {
  let base = slugify(name ?? '');
  if (base.length > 0) return `${base}-${generatePlainId(4)}`;

  return `magic-endpoint-${generatePlainId(10)}`;
};

type MagicMcpEndpointToolFilter =
  | {
      type: 'tool_keys';
      keys: string[];
    }
  | {
      type: 'tool_regex';
      pattern: string;
    }
  | {
      type: 'resource_regex';
      pattern: string;
    }
  | {
      type: 'resource_uris';
      uris: string[];
    }
  | {
      type: 'prompt_keys';
      keys: string[];
    }
  | {
      type: 'prompt_regex';
      pattern: string;
    };

export type MagicMcpEndpointToolFilters =
  | MagicMcpEndpointToolFilter
  | MagicMcpEndpointToolFilter[]
  | null;

type MagicMcpEndpointServerInput = {
  magicMcpServerId: string;
  toolFilters?: MagicMcpEndpointToolFilters;
};

let toNullableJson = (value: Prisma.InputJsonValue | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;

  return value;
};

let dedupeServerInputs = (servers?: MagicMcpEndpointServerInput[]) => {
  if (!servers?.length) return [];

  let entries = new Map<string, MagicMcpEndpointServerInput>();
  for (let server of servers) {
    entries.set(server.magicMcpServerId, server);
  }

  return Array.from(entries.values());
};

let listActiveServersForEndpoint = async (d: {
  instanceOid: bigint;
  requestedServers: MagicMcpEndpointServerInput[];
}) => {
  if (d.requestedServers.length === 0) return [];

  let servers = await db.magicMcpServer.findMany({
    where: {
      id: { in: d.requestedServers.map(server => server.magicMcpServerId) },
      instanceOid: d.instanceOid,
      status: 'active'
    },
    select: {
      id: true,
      oid: true
    }
  });

  if (servers.length !== d.requestedServers.length) {
    let resolvedIds = new Set(servers.map(server => server.id));
    let invalidIds = d.requestedServers
      .map(server => server.magicMcpServerId)
      .filter(serverId => !resolvedIds.has(serverId));

    throw new ServiceError(
      badRequestError({
        message:
          'All linked magic MCP servers must exist, be active, and belong to the same instance.',
        description: invalidIds.length
          ? `Invalid server IDs: ${invalidIds.join(', ')}`
          : undefined
      })
    );
  }

  return servers;
};

let getMagicMcpSessionDurationMinutes = async (
  instance: Pick<Instance, 'oid' | 'projectOid'>
) => {
  let projectOid =
    'projectOid' in instance && instance.projectOid
      ? instance.projectOid
      : (
          await db.instance.findUniqueOrThrow({
            where: { oid: instance.oid },
            select: { projectOid: true }
          })
        ).projectOid;
  let project = await db.project.findUniqueOrThrow({
    where: { oid: projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });

  return project.magicMcpSessionDurationMinutes;
};

let normalizeEndpointToolFilters = (
  toolFilters: MagicMcpEndpointToolFilters | undefined
): PrismaJson.ToolFilter | null | undefined => {
  if (toolFilters === undefined) return undefined;
  if (toolFilters === null) return null;

  return {
    type: 'v1.filter',
    filters: Array.isArray(toolFilters) ? toolFilters : [toolFilters]
  } as PrismaJson.ToolFilter;
};

export let magicMcpEndpointInclude = {
  consumerProfile: true,
  consumerIntegrationEndpoints: {
    include: {
      consumer: true,
      consumerProfile: true
    }
  },
  servers: {
    include: {
      magicMcpServer: {
        include: {
          aliases: true,
          subspaceSession: true
        }
      }
    }
  },
  subspaceSession: true
} satisfies Prisma.MagicMcpEndpointInclude;

export type MagicMcpEndpointWithRelations = Prisma.MagicMcpEndpointGetPayload<{
  include: typeof magicMcpEndpointInclude;
}>;

export let getMagicMcpEndpointSessionTemplateId = (
  endpoint: Pick<MagicMcpEndpoint, 'legacySubspaceSessionTemplateId' | 'newSubspaceSessionTemplateId'>
) => endpoint.newSubspaceSessionTemplateId ?? endpoint.legacySubspaceSessionTemplateId ?? null;

export let ensureMagicMcpEndpointBacking = async (d: {
  instance: Instance;
  endpoint: MagicMcpEndpointWithRelations;
  force?: boolean;
}) => {
  if (!d.force && d.endpoint.hasSubspaceBacking) {
    return {
      ...d.endpoint,
      instance: d.instance
    };
  }

  await Promise.all(
    d.endpoint.servers.map(server =>
      ensureMagicMcpServerBacking({
        instance: d.instance,
        server: server.magicMcpServer
      })
    )
  );

  let backing = await subspaceMagicMcpBackingService.upsertEndpoint({
    instance: d.instance,
    magicMcpEndpointBackingId: d.endpoint.id,
    name: d.endpoint.name,
    description: d.endpoint.description,
    metadata: d.endpoint.metadata as any,
    maxSessionDurationInMinutes: await getMagicMcpSessionDurationMinutes(d.instance),
    servers: d.endpoint.servers.map(server => ({
      id: `${d.endpoint.id}:${server.magicMcpServer.id}`,
      magicMcpServerBackingId: server.magicMcpServer.id,
      toolFilters: normalizeEndpointToolFilters(
        server.toolFilters as MagicMcpEndpointToolFilters | undefined
      )
    }))
  });

  let isSessionTemplateChanged = backing.sessionTemplateId !== d.endpoint.newSubspaceSessionTemplateId;

  return await db.magicMcpEndpoint.update({
    where: { oid: d.endpoint.oid },
    data: {
      hasSubspaceBacking: true,
      newSubspaceSessionTemplateId: backing.sessionTemplateId,
      subspaceEphemeralManagedSessionId: backing.ephemeralManagedSessionId,
      configurationHash: isSessionTemplateChanged ? null : undefined
    },
    include: { ...magicMcpEndpointInclude, instance: true }
  });
};

class MagicMcpEndpointImpl {
  async getMagicMcpEndpointById(d: {
    instance: Instance;
    magicMcpEndpointId: string;
    accessTags?: AnyAccessTagSelector;
  }) {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findFirst({
      where: {
        instanceOid: d.instance.oid,
        status: d.accessTags ? 'active' : undefined,
        id: d.magicMcpEndpointId
      },
      include: magicMcpEndpointInclude
    });
    if (!magicMcpEndpoint) {
      throw new ServiceError(notFoundError('magic_mcp.endpoint'));
    }

    if (d.accessTags) {
      await this.checkConsumerReadAccess({
        endpoint: magicMcpEndpoint,
        accessTags: d.accessTags
      });
    }

    return magicMcpEndpoint;
  }

  async getMagicMcpEndpointByIdOrSlug(d: {
    magicMcpEndpointIdOrSlug: string;
    instance?: Instance;
    accessTags?: AnyAccessTagSelector;
  }) {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findFirst({
      where: {
        instanceOid: d.instance?.oid,
        status: d.accessTags ? 'active' : 'active',
        OR: [{ id: d.magicMcpEndpointIdOrSlug }, { slug: d.magicMcpEndpointIdOrSlug }]
      },
      include: {
        ...magicMcpEndpointInclude,
        instance: true
      }
    });
    if (!magicMcpEndpoint) {
      throw new ServiceError(notFoundError('magic_mcp.endpoint'));
    }

    if (d.accessTags) {
      await this.checkConsumerReadAccess({
        endpoint: magicMcpEndpoint,
        accessTags: d.accessTags
      });
    }

    return magicMcpEndpoint;
  }

  async checkConsumerReadAccess(d: {
    endpoint: MagicMcpEndpoint;
    accessTags: AnyAccessTagSelector;
  }) {
    let accessTagFilter = await getAccessTagFilter({
      accessTags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    if (!accessTagFilter) return;

    let allowed = await db.magicMcpEndpoint.findFirst({
      where: {
        oid: d.endpoint.oid,
        accessTagEntities: accessTagFilter
      }
    });

    if (!allowed) {
      throw new ServiceError(notFoundError('magic_mcp.endpoint'));
    }
  }

  async checkWriteAccess(d: {
    endpoint: MagicMcpEndpoint;
    instance?: Instance;
    accessTags?: AnyAccessTagSelector;
  }) {
    if (d.accessTags) {
      let accessTagFilter = await getAccessTagFilter({
        accessTags: d.accessTags,
        roles: [...consumerMagicMcpWriteRoles]
      });
      let allowed = accessTagFilter
        ? await db.magicMcpEndpoint.findFirst({
            where: {
              oid: d.endpoint.oid,
              accessTagEntities: accessTagFilter
            }
          })
        : null;

      if (!allowed) {
        throw new ServiceError(notFoundError('magic_mcp.endpoint'));
      }

      return;
    }

    if (!d.instance || d.endpoint.instanceOid !== d.instance.oid) {
      throw new ServiceError(notFoundError('magic_mcp.endpoint'));
    }
  }

  async createMagicMcpEndpoint(d: {
    instance: Instance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      consumerProfile?: Pick<ConsumerProfile, 'oid'>;
      servers?: MagicMcpEndpointServerInput[];
    };
  }) {
    let requestedServers = dedupeServerInputs(d.input.servers);
    let serverInputsById = new Map(
      requestedServers.map(server => [server.magicMcpServerId, server] as const)
    );
    let servers = await listActiveServersForEndpoint({
      instanceOid: d.instance.oid,
      requestedServers
    });

    try {
      let magicMcpEndpoint = await db.magicMcpEndpoint.create({
        data: {
          id: await ID.generateId('magicMcpEndpoint'),
          status: 'active',
          isConsumerReconciled: true,
          instanceOid: d.instance.oid,
          consumerProfileOid: d.input.consumerProfile?.oid,
          name: d.input.name,
          description: d.input.description,
          slug: buildSlug(d.input.name),
          metadata: d.input.metadata ?? {},
          servers: servers.length
            ? {
                createMany: {
                  data: servers.map(server => ({
                    magicMcpServerOid: server.oid,
                    toolFilters: toNullableJson(
                      serverInputsById.get(server.id)?.toolFilters ?? null
                    )
                  }))
                }
              }
            : undefined
        },
        include: magicMcpEndpointInclude
      });
      magicMcpEndpoint = await ensureMagicMcpEndpointBacking({
        instance: d.instance,
        force: true,
        endpoint: magicMcpEndpoint
      });

      await magicMcpEndpointCreatedQueue.add({ magicMcpEndpointId: magicMcpEndpoint.id });

      return magicMcpEndpoint;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ServiceError(
          conflictError({
            message: 'Magic MCP endpoint slug is already in use'
          })
        );
      }

      throw error;
    }
  }

  async archiveMagicMcpEndpoint(d: { endpoint: MagicMcpEndpoint }) {
    if (d.endpoint.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP endpoint is already archived'
        })
      );
    }

    let magicMcpEndpoint = await db.magicMcpEndpoint.update({
      where: {
        id: d.endpoint.id
      },
      data: {
        status: 'archived',
        deletedAt: new Date()
      },
      include: {
        ...magicMcpEndpointInclude,
        instance: true
      }
    });

    if (d.endpoint.hasSubspaceBacking) {
      await subspaceMagicMcpBackingService.archiveEndpoint({
        instance: magicMcpEndpoint.instance,
        magicMcpEndpointBackingId: d.endpoint.id
      });
    }
    await magicMcpEndpointDeletedQueue.add({ magicMcpEndpointId: magicMcpEndpoint.id });

    return magicMcpEndpoint;
  }

  async updateMagicMcpEndpoint(d: {
    endpoint: MagicMcpEndpointWithRelations;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
    };
  }) {
    if (d.endpoint.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP endpoint that is not active'
        })
      );
    }

    let magicMcpEndpoint = await db.magicMcpEndpoint.update({
      where: {
        id: d.endpoint.id
      },
      data: {
        name: d.input.name === undefined ? d.endpoint.name : d.input.name,
        description:
          d.input.description === undefined ? d.endpoint.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.endpoint.metadata : d.input.metadata
      },
      include: { ...magicMcpEndpointInclude, instance: true }
    });
    magicMcpEndpoint = await ensureMagicMcpEndpointBacking({
      instance: magicMcpEndpoint.instance,
      force: true,
      endpoint: magicMcpEndpoint
    });

    await magicMcpEndpointUpdatedQueue.add({ magicMcpEndpointId: magicMcpEndpoint.id });

    return magicMcpEndpoint;
  }

  async addServersToEndpoint(d: {
    endpoint: MagicMcpEndpoint;
    servers: MagicMcpEndpointServerInput[];
  }) {
    let serverInputs = dedupeServerInputs(d.servers);
    let serverInputsById = new Map(
      serverInputs.map(server => [server.magicMcpServerId, server] as const)
    );
    let servers = await listActiveServersForEndpoint({
      instanceOid: d.endpoint.instanceOid,
      requestedServers: serverInputs
    });

    if (servers.length) {
      await Promise.all(
        servers.map(server => {
          return db.magicMcpEndpointServer.upsert({
            where: {
              magicMcpEndpointOid_magicMcpServerOid: {
                magicMcpEndpointOid: d.endpoint.oid,
                magicMcpServerOid: server.oid
              }
            },
            create: {
              magicMcpEndpointOid: d.endpoint.oid,
              magicMcpServerOid: server.oid,
              toolFilters: toNullableJson(serverInputsById.get(server.id)?.toolFilters ?? null)
            },
            update: {
              toolFilters: toNullableJson(serverInputsById.get(server.id)?.toolFilters ?? null)
            }
          });
        })
      );
    }

    let magicMcpEndpoint = await db.magicMcpEndpoint.findUniqueOrThrow({
      where: {
        id: d.endpoint.id
      },
      include: { ...magicMcpEndpointInclude, instance: true }
    });
    magicMcpEndpoint = await ensureMagicMcpEndpointBacking({
      instance: magicMcpEndpoint.instance,
      force: true,
      endpoint: magicMcpEndpoint
    });

    await magicMcpEndpointUpdatedQueue.add({ magicMcpEndpointId: magicMcpEndpoint.id });

    return magicMcpEndpoint;
  }

  async removeServersFromEndpoint(d: {
    endpoint: MagicMcpEndpoint;
    magicMcpServerIds: string[];
  }) {
    let servers = await db.magicMcpServer.findMany({
      where: {
        id: { in: d.magicMcpServerIds },
        instanceOid: d.endpoint.instanceOid
      }
    });

    if (servers.length) {
      await db.magicMcpEndpointServer.deleteMany({
        where: {
          magicMcpEndpointOid: d.endpoint.oid,
          magicMcpServerOid: { in: servers.map(server => server.oid) }
        }
      });
    }

    let magicMcpEndpoint = await db.magicMcpEndpoint.findUniqueOrThrow({
      where: {
        id: d.endpoint.id
      },
      include: { ...magicMcpEndpointInclude, instance: true }
    });
    magicMcpEndpoint = await ensureMagicMcpEndpointBacking({
      instance: magicMcpEndpoint.instance,
      force: true,
      endpoint: magicMcpEndpoint
    });

    await magicMcpEndpointUpdatedQueue.add({ magicMcpEndpointId: magicMcpEndpoint.id });

    return magicMcpEndpoint;
  }

  async listMagicMcpEndpoints(d: {
    instance: Instance;
    status?: MagicMcpEndpointStatus[];
    magicMcpServerIds?: string[];
    search?: string;
    accessTags?: AnyAccessTagSelector;
  }) {
    let normalizedSearch = d.search?.trim();
    if (!normalizedSearch?.length) normalizedSearch = undefined;

    let serverOids = d.magicMcpServerIds?.length
      ? (
          await db.magicMcpServer.findMany({
            where: {
              id: { in: d.magicMcpServerIds },
              instanceOid: d.instance.oid
            },
            select: {
              oid: true
            }
          })
        ).map(server => server.oid)
      : undefined;
    let accessTagFilter = await getAccessTagFilter({
      accessTags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    let statusFilter = getActiveStatusFilter({
      accessTags: d.accessTags,
      status: d.status,
      activeStatus: 'active'
    });

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpEndpoint.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: statusFilter ? { in: statusFilter } : { not: 'archived' as const },
            accessTagEntities: accessTagFilter,
            servers: serverOids?.length
              ? {
                  some: {
                    magicMcpServerOid: { in: serverOids }
                  }
                }
              : undefined,
            OR: normalizedSearch
              ? [
                  { id: { contains: normalizedSearch, mode: 'insensitive' } },
                  { slug: { contains: normalizedSearch, mode: 'insensitive' } },
                  { name: { contains: normalizedSearch, mode: 'insensitive' } },
                  {
                    description: {
                      contains: normalizedSearch,
                      mode: 'insensitive'
                    }
                  }
                ]
              : undefined
          },
          include: magicMcpEndpointInclude
        });
      })
    );
  }
}

export let magicMcpEndpointService = Service.create(
  'magicMcpEndpoint',
  () => new MagicMcpEndpointImpl()
).build();
