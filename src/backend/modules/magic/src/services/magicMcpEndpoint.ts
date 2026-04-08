import {
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
import { getAccessTagFilter, getActiveStatusFilter } from './consumerAccess';

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

export let magicMcpEndpointInclude = {
  consumerProfile: true,
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
    let servers = requestedServers.length
      ? await db.magicMcpServer.findMany({
          where: {
            id: { in: requestedServers.map(server => server.magicMcpServerId) },
            instanceOid: d.instance.oid
          },
          select: {
            id: true,
            oid: true
          }
        })
      : [];

    try {
      return await db.magicMcpEndpoint.create({
        data: {
          id: await ID.generateId('magicMcpEndpoint'),
          status: 'active',
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

    return await db.magicMcpEndpoint.update({
      where: {
        id: d.endpoint.id
      },
      data: {
        status: 'archived',
        deletedAt: new Date()
      },
      include: magicMcpEndpointInclude
    });
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

    return await db.magicMcpEndpoint.update({
      where: {
        id: d.endpoint.id
      },
      data: {
        name: d.input.name === undefined ? d.endpoint.name : d.input.name,
        description:
          d.input.description === undefined ? d.endpoint.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.endpoint.metadata : d.input.metadata
      },
      include: magicMcpEndpointInclude
    });
  }

  async addServersToEndpoint(d: {
    endpoint: MagicMcpEndpoint;
    servers: MagicMcpEndpointServerInput[];
  }) {
    let serverInputs = dedupeServerInputs(d.servers);
    let serverInputsById = new Map(
      serverInputs.map(server => [server.magicMcpServerId, server] as const)
    );
    let servers = await db.magicMcpServer.findMany({
      where: {
        id: { in: serverInputs.map(server => server.magicMcpServerId) },
        instanceOid: d.endpoint.instanceOid
      },
      select: {
        id: true,
        oid: true
      }
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

    return await db.magicMcpEndpoint.findUniqueOrThrow({
      where: {
        id: d.endpoint.id
      },
      include: magicMcpEndpointInclude
    });
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

    return await db.magicMcpEndpoint.findUniqueOrThrow({
      where: {
        id: d.endpoint.id
      },
      include: magicMcpEndpointInclude
    });
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
