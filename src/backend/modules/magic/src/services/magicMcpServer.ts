import {
  conflictError,
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import { Context } from '@metorial/context';
import {
  ConsumerSurface,
  db,
  ID,
  Instance,
  MagicMcpServer,
  MagicMcpServerSource,
  MagicMcpServerStatus,
  Organization,
  OrganizationActor,
  Prisma
} from '@metorial/db';
import { generatePlainId } from '@metorial/id';
import {
  accessTagService,
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { searchMagicMcpServerIds } from '@metorial/module-search';
import { subspaceSessionTemplateService } from '@metorial/module-subspace';
import {
  magicMcpServerCreatedQueue,
  magicMcpServerDeletedQueue,
  magicMcpServerUpdatedQueue
} from '../queues/lifecycle/magicMcpServer';
import { getAccessTagFilter, getActiveStatusFilter } from './consumerAccess';

let include = {
  aliases: true,
  consumerIntegrations: {
    include: {
      consumer: true,
      consumerProfile: true
    }
  },
  subspaceSession: true
} satisfies Prisma.MagicMcpServerInclude;

type MagicMcpServerWithRelations = Prisma.MagicMcpServerGetPayload<{
  include: typeof include;
}>;

let buildAlias = (name?: string | null) => {
  let base = slugify(name ?? '');
  if (base.length > 0) return `${base}-${generatePlainId(4)}`;

  return `magic-${generatePlainId(10)}`;
};

class MagicMcpServerImpl {
  async getMagicMcpServerById(d: {
    instance: Instance;
    magicMcpServerId: string;
    accessTags?: AnyAccessTagSelector;
    consumerSurface?: ConsumerSurface;
  }) {
    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        status: d.accessTags ? 'active' : undefined,
        OR: [
          {
            id: d.magicMcpServerId
          },
          {
            aliases: {
              some: {
                slug: d.magicMcpServerId
              }
            }
          }
        ]
      },
      include
    });
    if (!magicMcpServer) throw new ServiceError(notFoundError('magic_mcp.server'));

    if (d.accessTags) {
      await this.checkConsumerReadAccess({
        server: magicMcpServer,
        accessTags: d.accessTags,
        consumerSurface: d.consumerSurface
      });
    }

    return magicMcpServer;
  }

  async checkConsumerReadAccess(d: {
    server: MagicMcpServer;
    accessTags: AnyAccessTagSelector;
    consumerSurface?: ConsumerSurface;
  }) {
    if (d.consumerSurface) {
      // We allow to fetch magic mcp server that the consumer doesn't have access to
      // from the same portal by id, but we still need to check if the server is in the same portal
      let access = await db.consumerAccess.findFirst({
        where: {
          consumerGroup: { surfaceOid: d.consumerSurface.oid },
          magicMcpServerOid: d.server.oid
        }
      });
      if (access) return;
    }

    await accessTagService.checkResourceAccess({
      tags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles],
      checker: async filter => {
        return await db.magicMcpServer.findFirst({
          where: {
            oid: d.server.oid,
            accessTagEntities: filter
          }
        });
      }
    });
  }

  async listMagicMcpServerTools(d: {
    server: MagicMcpServer;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
  }) {
    await this.checkWriteOrReadAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });

    let tools = await subspaceSessionTemplateService.listTools({
      instance: d.instance,
      sessionTemplateId: d.server.subspaceSessionTemplateId
    });

    return tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createMagicMcpServer(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      source?: MagicMcpServerSource;
      providerTemplateId?: string;
      sessionTemplateId?: string;
    };
  }) {
    let sessionTemplateId =
      d.input.sessionTemplateId ??
      (
        await subspaceSessionTemplateService.create({
          instance: d.instance,
          name: `Magic MCP Template ${d.input.name ?? new Date().toISOString().slice(0, 10)}`,
          description: 'Auto-created for Magic MCP server',
          isInternal: true,
          metadata: d.input.metadata,
          providers: []
        })
      ).id;

    let magicMcpServer = await db.magicMcpServer.create({
      data: {
        id: await ID.generateId('magicMcpServer'),
        status: 'active',
        source: d.input.source ?? 'manual',
        isConsumerReconciled: true,
        providerTemplateId: d.input.providerTemplateId,
        subspaceSessionTemplateId: sessionTemplateId,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata ?? {},
        instanceOid: d.instance.oid,
        aliases: {
          create: {
            slug: buildAlias(d.input.name)
          }
        }
      },
      include: {
        instance: true
      }
    });

    await magicMcpServerCreatedQueue.add({ magicMcpServerId: magicMcpServer.id });

    return await db.magicMcpServer.findUniqueOrThrow({
      where: { id: magicMcpServer.id },
      include
    });
  }

  async checkWriteAccess(d: {
    server: MagicMcpServer;
    instance?: Instance;
    accessTags?: AnyAccessTagSelector;
  }) {
    if (d.accessTags) {
      await accessTagService.checkResourceAccess({
        tags: d.accessTags,
        roles: [...consumerMagicMcpWriteRoles],
        checker: async filter => {
          return await db.magicMcpServer.findFirst({
            where: {
              oid: d.server.oid,
              accessTagEntities: filter
            }
          });
        }
      });

      return;
    }

    if (!d.instance || d.server.instanceOid !== d.instance.oid) {
      throw new ServiceError(notFoundError('magic_mcp.server'));
    }
  }

  async checkWriteOrReadAccess(d: {
    server: MagicMcpServer;
    instance?: Instance;
    accessTags?: AnyAccessTagSelector;
  }) {
    if (d.accessTags) {
      await this.checkConsumerReadAccess({
        server: d.server,
        accessTags: d.accessTags
      });
      return;
    }

    if (!d.instance || d.server.instanceOid !== d.instance.oid) {
      throw new ServiceError(notFoundError('magic_mcp.server'));
    }
  }

  async archiveMagicMcpServer(d: { server: MagicMcpServer }) {
    if (d.server.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP server is already archived'
        })
      );
    }

    let magicMcpServer = await db.magicMcpServer.update({
      where: { id: d.server.id },
      data: { status: 'archived', deletedAt: new Date() },
      include
    });

    await magicMcpServerDeletedQueue.add({ magicMcpServerId: magicMcpServer.id });

    return magicMcpServer;
  }

  async updateMagicMcpServer(d: {
    server: MagicMcpServerWithRelations;
    instance?: Instance;
    accessTags?: AnyAccessTagSelector;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      aliases?: string[];
      sessionTemplateId?: string;
    };
  }) {
    await this.checkWriteAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });

    if (d.server.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP server that is not active'
        })
      );
    }

    let existingAliases = new Set(d.server.aliases.map(a => a.slug));
    let normalizedAliases =
      d.input.aliases?.map(alias => slugify(alias)).filter(alias => alias.length > 0) ?? [];
    let nextAliases = [...new Set(normalizedAliases)].filter(
      alias => !existingAliases.has(alias)
    );

    if (nextAliases.length > 0) {
      let conflictingAliases = await db.magicMcpServerAlias.findMany({
        where: {
          slug: { in: nextAliases },
          serverOid: { not: d.server.oid }
        },
        select: { slug: true }
      });

      if (conflictingAliases.length > 0) {
        throw new ServiceError(
          conflictError({
            message: 'One or more aliases are already in use',
            description: `Conflicting aliases: ${conflictingAliases.map(a => a.slug).join(', ')}`
          })
        );
      }
    }

    let nextSessionTemplateId =
      d.input.sessionTemplateId === undefined
        ? d.server.subspaceSessionTemplateId
        : d.input.sessionTemplateId;
    let isSessionTemplateChanged =
      nextSessionTemplateId !== d.server.subspaceSessionTemplateId;

    if (d.accessTags && isSessionTemplateChanged) {
      throw new ServiceError(
        forbiddenError({
          message: 'Consumers cannot change the session template for a magic MCP server'
        })
      );
    }

    let server;
    try {
      server = await db.magicMcpServer.update({
        where: { id: d.server.id },
        data: {
          name: d.input.name === undefined ? d.server.name : d.input.name,
          description:
            d.input.description === undefined ? d.server.description : d.input.description,
          metadata: d.input.metadata === undefined ? d.server.metadata : d.input.metadata,
          subspaceSessionTemplateId: nextSessionTemplateId,
          aliases: {
            create: nextAliases.map(slug => ({ slug }))
          }
        },
        include
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ServiceError(
          conflictError({
            message: 'One or more aliases are already in use'
          })
        );
      }
      throw error;
    }

    await magicMcpServerUpdatedQueue.add({ magicMcpServerId: server.id });

    return server;
  }

  async listMagicMcpServers(d: {
    instance: Instance;
    status?: MagicMcpServerStatus[];
    search?: string;
    groupIds?: string[];
    providerTemplateIds?: string[];
    ids?: string[];
    preconfiguredOnly?: boolean;
    accessTags?: AnyAccessTagSelector;
    filterAccessTags?: AnyAccessTagSelector;
    consumerSurface?: ConsumerSurface;
  }) {
    let normalizedSearch = d.search?.trim();
    if (!normalizedSearch?.length) normalizedSearch = undefined;

    let searchedServerIds = normalizedSearch
      ? await searchMagicMcpServerIds({
          instanceId: d.instance.id,
          query: normalizedSearch
        })
      : undefined;

    let groupOids = d.groupIds?.length
      ? (
          await db.magicMcpGroup.findMany({
            where: {
              instanceOid: d.instance.oid,
              id: { in: d.groupIds }
            },
            select: { oid: true }
          })
        ).map(g => g.oid)
      : undefined;

    let accessTagFilter = await getAccessTagFilter({
      accessTags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    let filterAccessTagFilter = await getAccessTagFilter({
      accessTags: d.filterAccessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    let statusFilter = getActiveStatusFilter({
      accessTags: d.accessTags,
      status: d.status,
      activeStatus: 'active'
    });
    let andFilters: Prisma.MagicMcpServerWhereInput[] = [];

    if (normalizedSearch) {
      andFilters.push({
        id: {
          in: searchedServerIds
        }
      });
    }

    if (filterAccessTagFilter) {
      andFilters.push({
        accessTagEntities: filterAccessTagFilter
      });
    }

    if (accessTagFilter) {
      if (d.ids && d.consumerSurface) {
        // We allow to fetch magic mcp server that the consumer doesn't have access to
        // from the same portal by id
        andFilters.push({
          OR: [
            { accessTagEntities: accessTagFilter },
            {
              consumerAccesses: {
                some: { consumerGroup: { surfaceOid: d.consumerSurface.oid } }
              }
            }
          ]
        });
      } else {
        andFilters.push({
          accessTagEntities: accessTagFilter
        });
      }
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpServer.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            id: d.ids ? { in: d.ids } : undefined,
            status: statusFilter ? { in: statusFilter } : { not: 'archived' as const },
            source: d.preconfiguredOnly ? { not: 'consumer_provider_template' } : undefined,
            providerTemplateId: d.providerTemplateIds?.length
              ? { in: d.providerTemplateIds }
              : undefined,
            groups: groupOids
              ? { some: { magicMcpGroupOid: { in: groupOids ?? [] } } }
              : undefined,
            AND: andFilters
          },
          include
        });
      })
    );
  }
}

export let magicMcpServerService = Service.create(
  'magicMcpServer',
  () => new MagicMcpServerImpl()
).build();
