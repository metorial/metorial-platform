import {
  conflictError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
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
  Prisma,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generatePlainId } from '@metorial/id';
import {
  accessTagService,
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { searchMagicMcpServerIds } from '@metorial/module-search';
import {
  magicMcpServerBackingService,
  magicMcpServerProviderService
} from '@metorial-subspace/module-integration';
import { sessionTemplateService } from '@metorial-subspace/module-session';
import { ensureMagicMcpServerBacking, type ConsumerOwner } from '../lib/backing';
import {
  magicMcpServerCreatedQueue,
  magicMcpServerDeletedQueue,
  magicMcpServerUpdatedQueue
} from '../queues/lifecycle/magicMcpServer';
import { getAccessTagFilter, getActiveStatusFilter } from './consumerAccess';

let include = {
  aliases: true,
  accessTagEntities: {
    include: {
      accessTagPolicy: true,
      accessTag: {
        include: {
          consumerGroup: {
            include: {
              personalOwner: {
                include: {
                  consumer: true
                }
              }
            }
          }
        }
      }
    }
  },
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

export type MagicMcpServerOwnerFilter = 'organization' | 'consumer';

let getOwnerSources = (owners?: MagicMcpServerOwnerFilter[]) => {
  if (!owners?.length) return undefined;

  let sources = new Set<MagicMcpServerSource>();
  if (owners.includes('organization')) sources.add('manual');
  if (owners.includes('consumer')) sources.add('consumer_provider_template');

  return Array.from(sources);
};

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

    let sessionTemplateId = d.server.legacySubspaceSessionTemplateId;

    if (!sessionTemplateId) {
      let server = d.server.hasSubspaceBacking
        ? d.server
        : await ensureMagicMcpServerBacking({
            instance: d.instance,
            server: d.server,
            isReconciliation: true,
            deferReconcile: false
          });
      let backing = await magicMcpServerBackingService.getMagicMcpServerBackingById({
        instance: d.instance,
        magicMcpServerBackingId: server.id
      });
      sessionTemplateId = backing.sessionTemplate.id;
    }

    if (!sessionTemplateId) return [];

    let tools = await sessionTemplateService.listSessionTemplateTools({
      instance: d.instance,
      sessionTemplateId
    });

    return tools
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(tool => ({
        id: tool.id,
        key: tool.key,
        name: tool.name,
        description: tool.description,
        value: {
          capabilities: tool.capabilities,
          constraints: tool.constraints,
          inputJsonSchema: tool.inputJsonSchema,
          instructions: tool.instructions,
          outputJsonSchema: tool.outputJsonSchema,
          tags: tool.tags
        },
        specification: { id: tool.specification.id },
        provider: { id: tool.provider.id },
        createdAt: tool.createdAt,
        updatedAt: tool.updatedAt
      }));
  }

  async createMagicMcpServer(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;
    auditScope: AuditScope;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      source?: MagicMcpServerSource;
      providerTemplateId?: string;
      subspaceIntegrationInstanceId?: string | null;
      providers?: {
        providerDeploymentId: string;
        providerConfigId?: string | null;
        providerAuthConfigId?: string | null;
        toolFilters?: PrismaJson.ToolFilter | null;
      }[];
      consumerOwner?: ConsumerOwner;
    };
  }) {
    await Fabric.fire('magic_mcp.server.created:before', {
      organization: d.organization,
      instance: d.instance
    });

    let magicMcpServer = await withTransaction(
      async db => {
        return await db.magicMcpServer.create({
          data: {
            id: await ID.generateId('magicMcpServer'),
            status: 'active',
            source: d.input.source ?? 'manual',
            isConsumerReconciled: true,
            isSubspaceBackingReconciling: true,
            providerTemplateId: d.input.providerTemplateId,
            subspaceIntegrationInstanceId: d.input.subspaceIntegrationInstanceId,
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
      },
      { ifExists: true }
    );

    await magicMcpServerCreatedQueue.add({
      magicMcpServerId: magicMcpServer.id,
      providers: d.input.providers,
      owner: d.input.consumerOwner,
      isReconciliation: false
    });

    let server = await db.magicMcpServer.findUniqueOrThrow({
      where: { id: magicMcpServer.id },
      include
    });

    await Fabric.fire('magic_mcp.server.created:after', {
      organization: d.organization,
      instance: d.instance,
      magicMcpServer: server,
      auditScope: d.auditScope
    });

    return server;
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

  async archiveMagicMcpServer(d: { server: MagicMcpServer; auditScope: AuditScope }) {
    if (d.server.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP server is already archived'
        })
      );
    }

    let magicMcpServer = await withTransaction(async db => {
      let endpointLinks = await db.magicMcpEndpointServer.findMany({
        where: {
          magicMcpServerOid: d.server.oid
        },
        select: {
          magicMcpEndpointOid: true
        }
      });

      await db.magicMcpEndpointServer.deleteMany({
        where: {
          magicMcpServerOid: d.server.oid
        }
      });

      if (endpointLinks.length) {
        await db.magicMcpSession.updateMany({
          where: {
            magicMcpEndpointOid: {
              in: endpointLinks.map(link => link.magicMcpEndpointOid)
            }
          },
          data: {
            isConsumerReconciled: false
          }
        });
      }

      return await db.magicMcpServer.update({
        where: { id: d.server.id },
        data: { status: 'archived', deletedAt: new Date() },
        include
      });
    });

    await magicMcpServerDeletedQueue.add({ magicMcpServerId: magicMcpServer.id });

    let instance = await db.instance.findUniqueOrThrow({
      where: {
        oid: d.server.instanceOid
      },
      include: {
        organization: true
      }
    });

    await Fabric.fire('magic_mcp.server.archived:after', {
      organization: instance.organization,
      instance,
      magicMcpServer,
      auditScope: d.auditScope
    });

    return magicMcpServer;
  }

  async updateMagicMcpServer(d: {
    server: MagicMcpServerWithRelations;
    instance?: Instance;
    accessTags?: AnyAccessTagSelector;
    auditScope: AuditScope;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      aliases?: string[];
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

    let server;
    try {
      server = await withTransaction(async db => {
        return await db.magicMcpServer.update({
          where: { id: d.server.id },
          data: {
            name: d.input.name === undefined ? d.server.name : d.input.name,
            description:
              d.input.description === undefined ? d.server.description : d.input.description,
            metadata: d.input.metadata === undefined ? d.server.metadata : d.input.metadata,
            isSubspaceBackingReconciling: true,
            aliases: {
              create: nextAliases.map(slug => ({ slug }))
            }
          },
          include
        });
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

    await magicMcpServerUpdatedQueue.add({
      magicMcpServerId: server.id,
      isReconciliation: false
    });

    let instance =
      d.instance ??
      (await db.instance.findUniqueOrThrow({ where: { oid: d.server.instanceOid } }));

    await Fabric.fire('magic_mcp.server.updated:after', {
      instance,
      magicMcpServer: server,
      previousMagicMcpServer: d.server,
      auditScope: d.auditScope
    });

    return server;
  }

  async listMagicMcpServerProviders(d: {
    server: MagicMcpServer;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    allowDeleted?: boolean;
    status?: ('pending' | 'active' | 'archived' | 'deleted')[];
    ids?: string[];
    providerIds?: string[];
    integrationProviderIds?: string[];
    integrationInstanceProviderIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    createdAt?: any;
    updatedAt?: any;
  }) {
    await this.checkWriteOrReadAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });

    let server = d.server.hasSubspaceBacking
      ? d.server
      : await ensureMagicMcpServerBacking({
          instance: d.instance,
          server: d.server,
          isReconciliation: true,
          deferReconcile: false
        });

    return await magicMcpServerProviderService.listMagicMcpServerProviders({
      instance: d.instance,
      allowDeleted: d.allowDeleted,
      status: d.status,
      ids: d.ids,
      magicMcpServerBackingIds: [server.id],
      providerIds: d.providerIds,
      integrationProviderIds: d.integrationProviderIds,
      integrationInstanceProviderIds: d.integrationInstanceProviderIds,
      providerDeploymentIds: d.providerDeploymentIds,
      providerConfigIds: d.providerConfigIds,
      providerAuthConfigIds: d.providerAuthConfigIds,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    });
  }

  async getMagicMcpServerProviderById(d: {
    server: MagicMcpServer;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    magicMcpServerProviderId: string;
    allowDeleted?: boolean;
  }) {
    await this.checkWriteOrReadAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });

    let server = d.server.hasSubspaceBacking
      ? d.server
      : await ensureMagicMcpServerBacking({
          instance: d.instance,
          server: d.server,
          isReconciliation: true,
          deferReconcile: false
        });
    let provider = await magicMcpServerProviderService.getMagicMcpServerProviderById({
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId,
      allowDeleted: d.allowDeleted
    });
    if (provider.magicMcpServerBacking.id !== server.id) {
      throw new ServiceError(notFoundError('magic_mcp.server_provider'));
    }

    return provider;
  }

  async createMagicMcpServerProvider(d: {
    server: MagicMcpServer;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    input: {
      providerId: string;
      providerDeploymentId?: string;
      providerConfigId?: string | null;
      providerAuthConfigId?: string | null;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    await this.checkWriteAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });

    await db.magicMcpServer.update({
      where: { oid: d.server.oid },
      data: { isSubspaceBackingReconciling: true }
    });

    let server = await ensureMagicMcpServerBacking({
      instance: d.instance,
      server: d.server,
      isReconciliation: false,
      deferReconcile: false
    });

    return await magicMcpServerProviderService.createMagicMcpServerProvider({
      instance: d.instance,
      magicMcpServerBackingId: server.id,
      input: d.input
    });
  }

  async updateMagicMcpServerProvider(d: {
    server: MagicMcpServer;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    magicMcpServerProviderId: string;
    input: {
      providerDeploymentId?: string;
      providerConfigId?: string | null;
      providerAuthConfigId?: string | null;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    await this.checkWriteAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });
    await this.getMagicMcpServerProviderById({
      server: d.server,
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId,
      allowDeleted: true
    });

    return await magicMcpServerProviderService.updateMagicMcpServerProvider({
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId,
      input: d.input
    });
  }

  async archiveMagicMcpServerProvider(d: {
    server: MagicMcpServer;
    instance: Instance;
    accessTags?: AnyAccessTagSelector;
    magicMcpServerProviderId: string;
  }) {
    await this.checkWriteAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });
    await this.getMagicMcpServerProviderById({
      server: d.server,
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId,
      allowDeleted: true
    });

    return await magicMcpServerProviderService.archiveMagicMcpServerProvider({
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId
    });
  }

  async listMagicMcpServers(d: {
    instance: Instance;
    status?: MagicMcpServerStatus[];
    search?: string;
    groupIds?: string[];
    providerTemplateIds?: string[];
    subspaceIntegrationInstanceIds?: string[];
    providerIds?: string[];
    ids?: string[];
    owners?: MagicMcpServerOwnerFilter[];
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
    let ownerSources = getOwnerSources(d.owners);
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

    if (!ownerSources && !d.accessTags && !d.filterAccessTags && !d.consumerSurface) {
      andFilters.push({
        source: 'manual'
      });
    }

    if (d.subspaceIntegrationInstanceIds?.length) {
      let backingIds = await Promise.all(
        d.subspaceIntegrationInstanceIds.map(async integrationInstanceId => {
          return await magicMcpServerBackingService.resolveMagicMcpServerBackingIdsForIntegrationInstanceUsage(
            {
              instance: d.instance,
              integrationInstanceId,
              ownerTypes: ['server_owned', 'provider_template', 'integration']
            }
          );
        })
      );

      andFilters.push({
        id: {
          in: Array.from(new Set(backingIds.flat()))
        }
      });
    }

    if (d.providerIds?.length) {
      let providerServerIds =
        await magicMcpServerProviderService.resolveMagicMcpServerBackingIds({
          instance: d.instance,
          providerIds: d.providerIds
        });

      andFilters.push({
        id: {
          in: providerServerIds
        }
      });
    }

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpServer.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            id: d.ids ? { in: d.ids } : undefined,
            status: statusFilter ? { in: statusFilter } : { not: 'archived' as const },
            source: d.preconfiguredOnly
              ? { not: 'consumer_provider_template' }
              : ownerSources
                ? { in: ownerSources }
                : undefined,
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
