import {
  conflictError,
  forbiddenError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { slugify } from '@lowerdeck/slugify';
import {
  ConsumerProfile,
  db,
  ID,
  Instance,
  MagicMcpEndpoint,
  MagicMcpEndpointStatus,
  MagicMcpServer,
  OrganizationActor,
  Prisma,
  withTransaction
} from '@metorial/db';
import {
  assertCanAttachCoreOwnedResources,
  assertCanChangeCoreOwnerLock,
  assertCanChangeCoreOwnerOnlyVisibility,
  assertCanSeeCoreOwnedResource,
  assertCanUseCoreOwnedResources,
  getOwnershipAccessor,
  internalOwnershipAccessor,
  ownedCoreResourceWhere,
  subspaceScopeService,
  type OwnershipFilter
} from '@metorial-subspace/module-tenant';
import {
  ensureMagicMcpEndpointBacking,
  setMagicMcpEndpointBackingOwnerLock
} from '../lib/backing';
import { magicMcpServerOwnerActorSelect } from '../lib/ownerActor';
import { Fabric } from '@metorial/fabric';
import { generatePlainId } from '@metorial/id';
import { flagService } from '@metorial/module-flags';
import {
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { magicMcpEndpointDeletedQueue } from '../queues/lifecycle/magicMcpEndpoint';
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
      type: 'tool_categories';
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
  MagicMcpEndpointToolFilter | MagicMcpEndpointToolFilter[] | null;

type MagicMcpEndpointServerInput = {
  magicMcpServerId: string;
  toolFilters?: MagicMcpEndpointToolFilters;
};

let toNullableJson = (value: Prisma.InputJsonValue | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;

  return value;
};

let hasToolFiltersInput = (input: MagicMcpEndpointServerInput | undefined) =>
  !!input && Object.prototype.hasOwnProperty.call(input, 'toolFilters');

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
  ownerActor: magicMcpServerOwnerActorSelect,
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
          subspaceSession: true,
          ownerActor: magicMcpServerOwnerActorSelect
        }
      }
    }
  },
  subspaceSession: true,
  skillPlugin: true
} satisfies Prisma.MagicMcpEndpointInclude;

export type MagicMcpEndpointWithRelations = Prisma.MagicMcpEndpointGetPayload<{
  include: typeof magicMcpEndpointInclude;
}>;

let applyEndpointBacking = async (d: {
  instance: Instance;
  endpoint: MagicMcpEndpointWithRelations;
}) => {
  let backed = await ensureMagicMcpEndpointBacking(d);

  return {
    ...d.endpoint,
    hasSubspaceBacking: backed.hasSubspaceBacking,
    subspaceEphemeralManagedSessionId: backed.subspaceEphemeralManagedSessionId,
    isSubspaceBackingReconciling: backed.isSubspaceBackingReconciling
  };
};

class MagicMcpEndpointImpl {
  private async assertSkillEditingAvailable(d: { instance: Pick<Instance, 'oid'> }) {
    let skillsEnabled = await flagService.isFlagEnabledForInstance({
      instance: d.instance,
      flag: 'skills-enabled'
    });
    if (!skillsEnabled) {
      throw new ServiceError(
        forbiddenError({
          message:
            'Skill editing can only be enabled when skills are enabled for this instance'
        })
      );
    }

    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.instance.oid },
      include: { project: true }
    });
    if (!instance.project.allowConsumerSkillEditing) {
      throw new ServiceError(
        forbiddenError({
          message: 'Skill editing is turned off for this project'
        })
      );
    }
  }

  async getMagicMcpEndpointById(d: {
    instance: Instance;
    magicMcpEndpointId: string;
    accessTags?: AnyAccessTagSelector;
    organizationActor?: OrganizationActor;
    includeSystemOwned?: boolean;
  }) {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findFirst({
      where: {
        instanceOid: d.instance.oid,
        status: d.accessTags ? 'active' : undefined,
        isSystemOwned: d.includeSystemOwned ? undefined : false,
        id: d.magicMcpEndpointId
      },
      include: magicMcpEndpointInclude
    });
    if (!magicMcpEndpoint) {
      throw new ServiceError(notFoundError('magic_mcp.endpoint'));
    }

    if (d.organizationActor) {
      await assertCanSeeCoreOwnedResource(await this.getAccessor(d), magicMcpEndpoint, {
        resource: 'magic_mcp.endpoint',
        id: d.magicMcpEndpointId
      });
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
    includeSystemOwned?: boolean;
  }) {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findFirst({
      where: {
        instanceOid: d.instance?.oid,
        isSystemOwned: d.includeSystemOwned ? undefined : false,
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
    auditScope: AuditScope;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      consumerProfile?: Pick<ConsumerProfile, 'oid'>;
      skillPlugin?: { oid: bigint } | null;
      enableSkillEditing?: boolean;
      servers?: MagicMcpEndpointServerInput[];
      isSystemOwned?: boolean;
    };
    organizationActor?: OrganizationActor;
  }) {
    if (d.input.enableSkillEditing) {
      await this.assertSkillEditingAvailable({ instance: d.instance });
    }

    await Fabric.fire('magic_mcp.endpoint.created:before', {
      instance: d.instance
    });

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
            oid: true,
            ownerActorOid: true,
            isOwnerLocked: true,
            isOwnerOnlyVisible: true,
            isSystemOwned: true
          }
        })
      : [];

    await this.assertCanUseServers({
      instance: d.instance,
      organizationActor: d.input.consumerProfile ? undefined : d.organizationActor,
      servers
    });

    let accessor = await this.getAccessor({
      instance: d.instance,
      organizationActor: d.organizationActor
    });
    let inheritedOwnerActorOid = accessor.isEnforced
      ? (servers.find(server => server.ownerActorOid)?.ownerActorOid ?? null)
      : null;
    if (!d.input.consumerProfile && inheritedOwnerActorOid) {
      await assertCanAttachCoreOwnedResources(
        accessor,
        { ownerActorOid: inheritedOwnerActorOid },
        servers,
        { resource: 'magic MCP server' }
      );
    }
    let inheritedIsOwnerOnlyVisible =
      accessor.isEnforced && servers.some(server => server.isOwnerOnlyVisible);

    let endpointServerRows = await Promise.all(
      servers.map(async server => ({
        id: await ID.generateId('magicMcpEndpoint'),
        magicMcpServerOid: server.oid,
        toolFilters: toNullableJson(serverInputsById.get(server.id)?.toolFilters ?? null)
      }))
    );

    try {
      let magicMcpEndpoint = await withTransaction(
        async db => {
          return await db.magicMcpEndpoint.create({
            data: {
              id: await ID.generateId('magicMcpEndpoint'),
              status: 'active',
              isConsumerReconciled: true,
              instanceOid: d.instance.oid,
              consumerProfileOid: d.input.consumerProfile?.oid,
              skillPluginOid: d.input.skillPlugin?.oid,
              enableSkillEditing: d.input.enableSkillEditing ?? false,
              name: d.input.name,
              description: d.input.description,
              slug: buildSlug(d.input.name),
              metadata: d.input.metadata ?? {},
              isSystemOwned: !!d.input.isSystemOwned,
              ...(!d.input.isSystemOwned && !d.input.consumerProfile && inheritedOwnerActorOid
                ? {
                    ownerActorOid: inheritedOwnerActorOid,
                    isOwnerOnlyVisible: inheritedIsOwnerOnlyVisible
                  }
                : {}),
              servers: endpointServerRows.length
                ? {
                    createMany: {
                      data: endpointServerRows
                    }
                  }
                : undefined
            },
            include: magicMcpEndpointInclude
          });
        },
        { ifExists: true }
      );

      try {
        magicMcpEndpoint = await applyEndpointBacking({
          instance: d.instance,
          endpoint: magicMcpEndpoint
        });
      } catch (error) {
        await db.magicMcpEndpoint.update({
          where: { oid: magicMcpEndpoint.oid },
          data: { status: 'archived', deletedAt: new Date() }
        });

        throw error;
      }

      await Fabric.fire('magic_mcp.endpoint.created:after', {
        instance: d.instance,
        magicMcpEndpoint,
        auditScope: d.auditScope
      });

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

  async archiveMagicMcpEndpoint(d: { endpoint: MagicMcpEndpoint; auditScope: AuditScope }) {
    if (d.endpoint.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP endpoint is already archived'
        })
      );
    }

    let magicMcpEndpoint = await withTransaction(async db => {
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
    });

    await magicMcpEndpointDeletedQueue.add({ magicMcpEndpointId: magicMcpEndpoint.id });

    let instance = await db.instance.findUniqueOrThrow({
      where: {
        oid: d.endpoint.instanceOid
      }
    });

    await Fabric.fire('magic_mcp.endpoint.archived:after', {
      instance,
      magicMcpEndpoint,
      auditScope: d.auditScope
    });

    return magicMcpEndpoint;
  }

  async updateMagicMcpEndpoint(d: {
    endpoint: MagicMcpEndpointWithRelations;
    auditScope: AuditScope;
    organizationActor?: OrganizationActor;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      enableSkillEditing?: boolean;
      source?: 'explorer';
      isOwnerLocked?: boolean;
      isOwnerOnlyVisible?: boolean;
    };
  }) {
    if (d.endpoint.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP endpoint that is not active'
        })
      );
    }

    let isOwnerLockChanged =
      d.input.isOwnerLocked !== undefined &&
      d.input.isOwnerLocked !== d.endpoint.isOwnerLocked;
    let nextIsOwnerLocked = isOwnerLockChanged
      ? !!d.input.isOwnerLocked ||
        d.endpoint.servers.some(server => server.magicMcpServer.isOwnerLocked)
      : d.endpoint.isOwnerLocked;

    if (isOwnerLockChanged && d.organizationActor) {
      let lockInstance = await db.instance.findUniqueOrThrow({
        where: { oid: d.endpoint.instanceOid }
      });
      let { tenant } = await subspaceScopeService.ensureForInstance(lockInstance);
      await assertCanChangeCoreOwnerLock(
        await getOwnershipAccessor({ tenant, organizationActor: d.organizationActor }),
        d.endpoint,
        d.input.isOwnerLocked,
        { resource: 'magic MCP endpoint' }
      );
    }

    let isOwnerOnlyVisibleChanged =
      d.input.isOwnerOnlyVisible !== undefined &&
      d.input.isOwnerOnlyVisible !== d.endpoint.isOwnerOnlyVisible;
    let nextIsOwnerOnlyVisible = isOwnerOnlyVisibleChanged
      ? !!d.input.isOwnerOnlyVisible ||
        d.endpoint.servers.some(server => server.magicMcpServer.isOwnerOnlyVisible)
      : d.endpoint.isOwnerOnlyVisible;

    if (isOwnerOnlyVisibleChanged && d.organizationActor) {
      let visibilityInstance = await db.instance.findUniqueOrThrow({
        where: { oid: d.endpoint.instanceOid }
      });
      await assertCanChangeCoreOwnerOnlyVisibility(
        await this.getAccessor({
          instance: visibilityInstance,
          organizationActor: d.organizationActor
        }),
        d.endpoint,
        d.input.isOwnerOnlyVisible,
        { resource: 'magic MCP endpoint' }
      );
    }

    if (d.input.enableSkillEditing && !d.endpoint.enableSkillEditing) {
      await this.assertSkillEditingAvailable({ instance: { oid: d.endpoint.instanceOid } });
    }

    let magicMcpEndpoint = await withTransaction(async db => {
      return await db.magicMcpEndpoint.update({
        where: {
          id: d.endpoint.id
        },
        data: {
          name: d.input.name === undefined ? d.endpoint.name : d.input.name,
          description:
            d.input.description === undefined ? d.endpoint.description : d.input.description,
          metadata: d.input.metadata === undefined ? d.endpoint.metadata : d.input.metadata,
          enableSkillEditing: d.input.enableSkillEditing,
          source: d.input.source,
          isOwnerLocked: nextIsOwnerLocked,
          isOwnerOnlyVisible: nextIsOwnerOnlyVisible
        },
        include: magicMcpEndpointInclude
      });
    });

    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.endpoint.instanceOid }
    });

    magicMcpEndpoint = await applyEndpointBacking({ instance, endpoint: magicMcpEndpoint });

    if (isOwnerLockChanged && magicMcpEndpoint.hasSubspaceBacking) {
      await setMagicMcpEndpointBackingOwnerLock({
        instance,
        endpoint: magicMcpEndpoint,
        isOwnerLocked: nextIsOwnerLocked
      });
    }

    await Fabric.fire('magic_mcp.endpoint.updated:after', {
      instance,
      magicMcpEndpoint,
      previousMagicMcpEndpoint: d.endpoint,
      auditScope: d.auditScope
    });

    return magicMcpEndpoint;
  }

  private async getAccessor(d: {
    instance: Pick<Instance, 'oid'> | Instance;
    organizationActor?: OrganizationActor;
  }) {
    if (!d.organizationActor) return internalOwnershipAccessor;

    let instance = await db.instance.findUniqueOrThrow({ where: { oid: d.instance.oid } });
    let { tenant } = await subspaceScopeService.ensureForInstance(instance);

    return await getOwnershipAccessor({ tenant, organizationActor: d.organizationActor });
  }

  private async assertCanUseServers(d: {
    instance: Pick<Instance, 'oid'> | Instance;
    organizationActor?: OrganizationActor;
    servers: Pick<
      MagicMcpServer,
      'id' | 'ownerActorOid' | 'isOwnerLocked' | 'isOwnerOnlyVisible' | 'isSystemOwned'
    >[];
  }) {
    if (!d.servers.length) return;

    await assertCanUseCoreOwnedResources(await this.getAccessor(d), d.servers, {
      resource: 'magic MCP server'
    });
  }

  async addServersToEndpoint(d: {
    endpoint: MagicMcpEndpoint;
    servers: MagicMcpEndpointServerInput[];
    auditScope: AuditScope;
    organizationActor?: OrganizationActor;
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
        oid: true,
        name: true,
        status: true,
        ownerActorOid: true,
        isOwnerLocked: true,
        isOwnerOnlyVisible: true,
        isSystemOwned: true
      }
    });

    if (servers.some(server => server.status !== 'active')) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Magic MCP endpoints can only be linked to active magic MCP servers'
        })
      );
    }

    let existingEndpointServers = servers.length
      ? await db.magicMcpEndpointServer.findMany({
          where: {
            magicMcpEndpointOid: d.endpoint.oid,
            magicMcpServerOid: { in: servers.map(server => server.oid) }
          },
          select: {
            magicMcpServerOid: true
          }
        })
      : [];
    let existingServerOids = new Set(
      existingEndpointServers.map(server => server.magicMcpServerOid)
    );
    let hasNewServers = servers.some(server => !existingServerOids.has(server.oid));

    let newServers = servers.filter(server => !existingServerOids.has(server.oid));

    await this.assertCanUseServers({
      instance: { oid: d.endpoint.instanceOid },
      organizationActor: d.organizationActor,
      servers: newServers
    });

    await assertCanAttachCoreOwnedResources(
      await this.getAccessor({
        instance: { oid: d.endpoint.instanceOid },
        organizationActor: d.organizationActor
      }),
      d.endpoint,
      newServers,
      { resource: 'magic MCP server' }
    );

    let magicMcpEndpoint = await withTransaction(async db => {
      if (servers.length) {
        await Promise.all(
          servers.map(async server => {
            let serverInput = serverInputsById.get(server.id);
            let toolFiltersUpdate = hasToolFiltersInput(serverInput)
              ? { toolFilters: toNullableJson(serverInput?.toolFilters) }
              : {};

            return db.magicMcpEndpointServer.upsert({
              where: {
                magicMcpEndpointOid_magicMcpServerOid: {
                  magicMcpEndpointOid: d.endpoint.oid,
                  magicMcpServerOid: server.oid
                }
              },
              create: {
                id: await ID.generateId('magicMcpEndpoint'),
                magicMcpEndpointOid: d.endpoint.oid,
                magicMcpServerOid: server.oid,
                toolFilters: toNullableJson(serverInput?.toolFilters ?? null)
              },
              update: toolFiltersUpdate
            });
          })
        );
      }

      if (hasNewServers) {
        await db.magicMcpSession.updateMany({
          where: {
            magicMcpEndpointOid: d.endpoint.oid
          },
          data: {
            isConsumerReconciled: false
          }
        });
      }

      return await db.magicMcpEndpoint.findUniqueOrThrow({
        where: {
          id: d.endpoint.id
        },
        include: magicMcpEndpointInclude
      });
    });

    magicMcpEndpoint = await applyEndpointBacking({
      instance: await db.instance.findUniqueOrThrow({
        where: { oid: d.endpoint.instanceOid }
      }),
      endpoint: magicMcpEndpoint
    });

    await Fabric.fire('magic_mcp.endpoint.servers.modified:after', {
      magicMcpEndpoint,
      operation: 'add',
      servers: servers
        .filter(server => !existingServerOids.has(server.oid))
        .map(server => ({ id: server.id, name: server.name })),
      auditScope: d.auditScope
    });

    return magicMcpEndpoint;
  }

  async removeServersFromEndpoint(d: {
    endpoint: MagicMcpEndpoint;
    magicMcpServerIds: string[];
    auditScope: AuditScope;
  }) {
    let servers = await db.magicMcpServer.findMany({
      where: {
        id: { in: d.magicMcpServerIds },
        instanceOid: d.endpoint.instanceOid
      }
    });

    let removedServerOids = servers.length
      ? new Set(
          (
            await db.magicMcpEndpointServer.findMany({
              where: {
                magicMcpEndpointOid: d.endpoint.oid,
                magicMcpServerOid: { in: servers.map(server => server.oid) }
              },
              select: { magicMcpServerOid: true }
            })
          ).map(link => link.magicMcpServerOid)
        )
      : new Set<bigint>();

    let magicMcpEndpoint = await withTransaction(async db => {
      if (servers.length) {
        let result = await db.magicMcpEndpointServer.deleteMany({
          where: {
            magicMcpEndpointOid: d.endpoint.oid,
            magicMcpServerOid: { in: servers.map(server => server.oid) }
          }
        });

        if (result.count > 0) {
          await db.magicMcpSession.updateMany({
            where: {
              magicMcpEndpointOid: d.endpoint.oid
            },
            data: {
              isConsumerReconciled: false
            }
          });
        }
      }

      return await db.magicMcpEndpoint.findUniqueOrThrow({
        where: {
          id: d.endpoint.id
        },
        include: magicMcpEndpointInclude
      });
    });

    magicMcpEndpoint = await applyEndpointBacking({
      instance: await db.instance.findUniqueOrThrow({
        where: { oid: d.endpoint.instanceOid }
      }),
      endpoint: magicMcpEndpoint
    });

    await Fabric.fire('magic_mcp.endpoint.servers.modified:after', {
      magicMcpEndpoint,
      operation: 'remove',
      servers: servers
        .filter(server => removedServerOids.has(server.oid))
        .map(server => ({ id: server.id, name: server.name })),
      auditScope: d.auditScope
    });

    return magicMcpEndpoint;
  }

  async listMagicMcpEndpoints(d: {
    instance: Instance;
    status?: MagicMcpEndpointStatus[];
    magicMcpServerIds?: string[];
    search?: string;
    accessTags?: AnyAccessTagSelector;
    organizationActor?: OrganizationActor;
    ownership?: OwnershipFilter;
    includeSystemOwned?: boolean;
  }) {
    let normalizedSearch = d.search?.trim();
    let ownershipWhere = ownedCoreResourceWhere(await this.getAccessor(d), {
      ownership: d.ownership,
      includeSystemOwned: d.includeSystemOwned
    });
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
            AND: [ownershipWhere],
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
