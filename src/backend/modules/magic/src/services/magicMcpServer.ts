import {
  badRequestError,
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
  MagicMcpServerOwnerType,
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
import {
  subspaceMagicMcpBackingService,
  subspaceMagicMcpServerProviderService,
  subspaceSessionTemplateProviderService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
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

type MagicMcpServerWithTemplateState = Pick<
  MagicMcpServer,
  | 'hasSubspaceBacking'
  | 'legacySubspaceSessionTemplateId'
  | 'newSubspaceSessionTemplateId'
  | 'subspaceEphemeralManagedSessionId'
>;

let buildAlias = (name?: string | null) => {
  let base = slugify(name ?? '');
  if (base.length > 0) return `${base}-${generatePlainId(4)}`;

  return `magic-${generatePlainId(10)}`;
};

export let getMagicMcpServerSessionTemplateId = (server: MagicMcpServerWithTemplateState) =>
  server.newSubspaceSessionTemplateId ?? server.legacySubspaceSessionTemplateId ?? null;

type MagicMcpServerProviderInput = {
  providerDeploymentId: string;
  providerConfigId?: string | null;
  providerAuthConfigId?: string | null;
  toolFilters?: PrismaJson.ToolFilter | null;
};

type MagicMcpServerOwnerInput = {
  ownerType?: MagicMcpServerOwnerType;
  providerTemplateId?: string | null;
  subspaceOwnerIntegrationId?: string | null;
};

let getMagicMcpSessionDurationMinutes = async (instance: Instance) => {
  let project = await db.project.findUniqueOrThrow({
    where: { oid: instance.projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });

  return project.magicMcpSessionDurationMinutes;
};

let normalizeMagicMcpServerOwnerInput = (d: MagicMcpServerOwnerInput) => {
  let ownerType =
    d.ownerType ??
    (d.providerTemplateId
      ? ('provider_template' as const)
      : d.subspaceOwnerIntegrationId
        ? ('integration' as const)
        : ('server_owned' as const));

  if (ownerType === 'provider_template') {
    if (!d.providerTemplateId) {
      throw new ServiceError(
        badRequestError({
          message:
            'providerTemplateId is required for provider-template-owned magic MCP servers.',
          code: 'magic_mcp_server_provider_template_required'
        })
      );
    }
    return {
      ownerType,
      providerTemplateId: d.providerTemplateId,
      subspaceOwnerIntegrationId: null
    };
  }
  if (ownerType === 'integration') {
    if (!d.subspaceOwnerIntegrationId) {
      throw new ServiceError(
        badRequestError({
          message: 'ownerIntegrationId is required for integration-owned magic MCP servers.',
          code: 'magic_mcp_server_owner_integration_required'
        })
      );
    }
    return {
      ownerType,
      providerTemplateId: null,
      subspaceOwnerIntegrationId: d.subspaceOwnerIntegrationId
    };
  }

  return {
    ownerType: 'server_owned' as const,
    providerTemplateId: null,
    subspaceOwnerIntegrationId: null
  };
};

let isInheritedMagicMcpServer = (server: Pick<MagicMcpServer, 'ownerType'>) =>
  server.ownerType === 'provider_template' || server.ownerType === 'integration';

let upsertProviderTemplateBackingForMagicMcpServer = async (d: {
  instance: Instance;
  providerTemplateId?: string | null;
}) => {
  if (!d.providerTemplateId) return;

  let providerTemplate = await db.providerTemplate.findFirst({
    where: {
      id: d.providerTemplateId,
      instanceOid: d.instance.oid
    }
  });
  if (!providerTemplate) throw new ServiceError(notFoundError('provider.template'));

  await subspaceMagicMcpBackingService.upsertProviderTemplate({
    instance: d.instance,
    providerTemplateId: providerTemplate.id,
    name: providerTemplate.name,
    description: providerTemplate.description,
    metadata: providerTemplate.metadata as Record<string, any>,
    providerDeploymentId: providerTemplate.providerDeploymentId
  });
};

let upsertMagicMcpServerBacking = async (d: {
  instance: Instance;
  magicMcpServerId: string;
  ownerType?: MagicMcpServerOwnerType;
  providerTemplateId?: string | null;
  subspaceOwnerIntegrationId?: string | null;
  name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  providers?: MagicMcpServerProviderInput[];
}) => {
  let owner = normalizeMagicMcpServerOwnerInput(d);
  await upsertProviderTemplateBackingForMagicMcpServer({
    instance: d.instance,
    providerTemplateId: owner.providerTemplateId
  });

  return await subspaceMagicMcpBackingService.upsertServer({
    instance: d.instance,
    magicMcpServerBackingId: d.magicMcpServerId,
    providerTemplateBackingId: owner.providerTemplateId,
    ownerIntegrationId: owner.subspaceOwnerIntegrationId,
    name: d.name,
    description: d.description,
    metadata: d.metadata ?? undefined,
    maxSessionDurationInMinutes: await getMagicMcpSessionDurationMinutes(d.instance),
    providers: d.providers
  });
};

let listMagicMcpServerProviderInputsForSessionTemplate = async (d: {
  instance: Instance;
  sessionTemplateId: string;
}) => {
  let paginator = await subspaceSessionTemplateProviderService.list({
    instance: d.instance,
    allowDeleted: false,
    status: ['active'],
    sessionTemplateIds: [d.sessionTemplateId]
  });
  let providers = (await paginator.run({ limit: 1000 })).items;

  return providers.map(provider => ({
    providerDeploymentId: provider.deployment.id,
    providerConfigId: provider.config?.id ?? null,
    providerAuthConfigId: provider.authConfig?.id ?? null,
    toolFilters: (provider.toolFilter as PrismaJson.ToolFilter | null | undefined) ?? null
  }));
};

let resolveMagicMcpServerProviderInputs = async (d: {
  instance: Instance;
  server: MagicMcpServer & MagicMcpServerWithTemplateState;
  providers?: MagicMcpServerProviderInput[];
}) => {
  if (d.providers !== undefined) {
    return d.providers;
  }

  let sessionTemplateId = getMagicMcpServerSessionTemplateId(d.server);
  if (sessionTemplateId) {
    return await listMagicMcpServerProviderInputsForSessionTemplate({
      instance: d.instance,
      sessionTemplateId
    });
  }

  if (d.server.hasSubspaceBacking) {
    throw new ServiceError(
      preconditionFailedError({
        message:
          'Cannot reconcile a magic MCP server without an existing session template to copy provider setup from.'
      })
    );
  }

  return undefined;
};

export let ensureMagicMcpServerBacking = async (d: {
  instance: Instance;
  server: MagicMcpServer;
  providers?: MagicMcpServerProviderInput[];
  force?: boolean;
}) => {
  if (
    !d.force &&
    d.server.hasSubspaceBacking &&
    d.server.newSubspaceSessionTemplateId &&
    d.server.subspaceEphemeralManagedSessionId
  ) {
    return d.server;
  }

  let providers = await resolveMagicMcpServerProviderInputs({
    instance: d.instance,
    server: d.server,
    providers: d.providers
  });

  let backing = await upsertMagicMcpServerBacking({
    instance: d.instance,
    magicMcpServerId: d.server.id,
    ownerType: d.server.ownerType,
    providerTemplateId: d.server.providerTemplateId,
    subspaceOwnerIntegrationId: d.server.subspaceOwnerIntegrationId,
    name: d.server.name,
    description: d.server.description,
    metadata: d.server.metadata as Record<string, unknown>,
    providers
  });

  return await db.magicMcpServer.update({
    where: { oid: d.server.oid },
    data: {
      hasSubspaceBacking: true,
      ownerType: d.server.ownerType,
      providerTemplateId: d.server.providerTemplateId,
      subspaceOwnerIntegrationId: d.server.subspaceOwnerIntegrationId,
      newSubspaceSessionTemplateId: backing.sessionTemplateId,
      subspaceEphemeralManagedSessionId: backing.ephemeralManagedSessionId
    }
  });
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

    let server = await ensureMagicMcpServerBacking({
      instance: d.instance,
      server: d.server
    });

    let tools = await subspaceSessionTemplateService.listTools({
      instance: d.instance,
      sessionTemplateId:
        getMagicMcpServerSessionTemplateId(server) ??
        (() => {
          throw new ServiceError(
            preconditionFailedError({
              message: 'Magic MCP server is missing session template configuration'
            })
          );
        })()
    });

    return tools.sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name)
    );
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
    createdAt?: { gt?: Date; lt?: Date };
    updatedAt?: { gt?: Date; lt?: Date };
  }) {
    await this.checkWriteOrReadAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });
    let server = await ensureMagicMcpServerBacking({
      instance: d.instance,
      server: d.server
    });

    return await subspaceMagicMcpServerProviderService.list({
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
    let server = await ensureMagicMcpServerBacking({
      instance: d.instance,
      server: d.server
    });
    let row = await subspaceMagicMcpServerProviderService.get({
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId,
      allowDeleted: d.allowDeleted
    });
    if (row.magicMcpServerId !== server.id) {
      throw new ServiceError(notFoundError('magic_mcp.server_provider'));
    }

    return row;
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
      toolFilters?: any | null;
    };
  }) {
    await this.checkWriteAccess({
      server: d.server,
      instance: d.instance,
      accessTags: d.accessTags
    });
    let server = await ensureMagicMcpServerBacking({
      instance: d.instance,
      server: d.server
    });

    return await subspaceMagicMcpServerProviderService.create({
      instance: d.instance,
      magicMcpServerBackingId: server.id,
      providerId: d.input.providerId,
      providerDeploymentId: d.input.providerDeploymentId,
      providerConfigId: d.input.providerConfigId,
      providerAuthConfigId: d.input.providerAuthConfigId,
      toolFilters: d.input.toolFilters
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
      toolFilters?: any | null;
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
      accessTags: d.accessTags,
      magicMcpServerProviderId: d.magicMcpServerProviderId
    });

    return await subspaceMagicMcpServerProviderService.update({
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId,
      providerDeploymentId: d.input.providerDeploymentId,
      providerConfigId: d.input.providerConfigId,
      providerAuthConfigId: d.input.providerAuthConfigId,
      toolFilters: d.input.toolFilters
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
      accessTags: d.accessTags,
      magicMcpServerProviderId: d.magicMcpServerProviderId
    });

    return await subspaceMagicMcpServerProviderService.delete({
      instance: d.instance,
      magicMcpServerProviderId: d.magicMcpServerProviderId
    });
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
      ownerType?: MagicMcpServerOwnerType;
      providerTemplateId?: string;
      subspaceOwnerIntegrationId?: string | null;
      providers?: MagicMcpServerProviderInput[];
    };
  }) {
    let magicMcpServerId = await ID.generateId('magicMcpServer');
    let owner = normalizeMagicMcpServerOwnerInput(d.input);
    let backing = await upsertMagicMcpServerBacking({
      instance: d.instance,
      magicMcpServerId,
      ownerType: owner.ownerType,
      providerTemplateId: owner.providerTemplateId,
      subspaceOwnerIntegrationId: owner.subspaceOwnerIntegrationId,
      name: d.input.name,
      description: d.input.description,
      metadata: d.input.metadata,
      providers: d.input.providers
    });

    let magicMcpServer = await db.magicMcpServer.create({
      data: {
        id: magicMcpServerId,
        status: 'active',
        source: d.input.source ?? 'manual',
        ownerType: owner.ownerType,
        isConsumerReconciled: true,
        hasSubspaceBacking: true,
        providerTemplateId: owner.providerTemplateId,
        subspaceOwnerIntegrationId: owner.subspaceOwnerIntegrationId,
        newSubspaceSessionTemplateId: backing.sessionTemplateId,
        subspaceEphemeralManagedSessionId: backing.ephemeralManagedSessionId,
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
      include: { ...include, instance: true }
    });

    if (d.server.hasSubspaceBacking) {
      await subspaceMagicMcpBackingService.archiveServer({
        instance: magicMcpServer.instance,
        magicMcpServerBackingId: d.server.id
      });
    }
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
      ownerType?: MagicMcpServerOwnerType;
      providerTemplateId?: string | null;
      subspaceOwnerIntegrationId?: string | null;
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
        ? d.server.newSubspaceSessionTemplateId
        : d.input.sessionTemplateId;
    let owner = normalizeMagicMcpServerOwnerInput({
      ownerType: d.input.ownerType ?? d.server.ownerType,
      providerTemplateId:
        d.input.providerTemplateId === undefined
          ? d.server.providerTemplateId
          : d.input.providerTemplateId,
      subspaceOwnerIntegrationId:
        d.input.subspaceOwnerIntegrationId === undefined
          ? d.server.subspaceOwnerIntegrationId
          : d.input.subspaceOwnerIntegrationId
    });
    let isSessionTemplateChanged =
      nextSessionTemplateId !== d.server.newSubspaceSessionTemplateId;

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
          ownerType: owner.ownerType,
          providerTemplateId: owner.providerTemplateId,
          subspaceOwnerIntegrationId: owner.subspaceOwnerIntegrationId,
          newSubspaceSessionTemplateId: nextSessionTemplateId,
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
    if (d.instance) {
      let syncedServer = await ensureMagicMcpServerBacking({
        instance: d.instance,
        server,
        force: true
      });
      server = await db.magicMcpServer.findUniqueOrThrow({
        where: { id: syncedServer.id },
        include
      });
    }

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
