import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  MagicMcpGroup,
  MagicMcpGroupStatus,
  Organization,
  OrganizationActor,
  withTransaction
} from '@metorial/db';
import {
  goneError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { generatePlainId } from '@metorial/id';
import { searchMagicMcpGroupIds } from '@metorial/module-search';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import { slugify } from '@lowerdeck/slugify';
import {
  magicMcpGroupCreatedQueue,
  magicMcpGroupDeletedQueue,
  magicMcpGroupUpdatedQueue
} from '../queues/lifecycle/magicMcpGroup';

let magicMcpGroupInclude = {
  servers: {
    include: {
      magicMcpServer: true
    }
  }
} as const;

class MagicMcpGroupImpl {
  async getMagicMcpGroupById(d: { instance: Instance; magicMcpGroupId: string }) {
    let magicMcpGroup = await db.magicMcpGroup.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.magicMcpGroupId
      }
    });
    if (!magicMcpGroup) throw new ServiceError(notFoundError('magic_mcp.group'));

    return magicMcpGroup;
  }

  async createMagicMcpGroup(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;
    auditScope: AuditScope;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    let slug = `${slugify(d.input.name ?? 'group')}-${generatePlainId(6).toLowerCase()}`;

    let magicMcpGroup = await db.magicMcpGroup.create({
      data: {
        id: await ID.generateId('magicMcpGroup'),
        status: 'active',
        instanceOid: d.instance.oid,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata || {},
        slug
      },
      include: magicMcpGroupInclude
    });

    await magicMcpGroupCreatedQueue.add({ magicMcpGroupId: magicMcpGroup.id });

    await Fabric.fire('magic_mcp.group.created:after', {
      instance: d.instance,
      magicMcpGroup,
      auditScope: d.auditScope
    });

    return magicMcpGroup;
  }

  async updateMagicMcpGroup(d: {
    group: MagicMcpGroup;
    auditScope: AuditScope;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, any> | null;
    };
  }) {
    if (d.group.status === 'deleted') {
      throw new ServiceError(
        goneError({
          message: 'This magic MCP group has been deleted'
        })
      );
    }

    if (d.group.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP group that is not active'
        })
      );
    }

    let magicMcpGroup = await db.magicMcpGroup.update({
      where: { id: d.group.id },
      data: {
        name: d.input.name === undefined ? d.group.name : d.input.name,
        description:
          d.input.description === undefined ? d.group.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.group.metadata : d.input.metadata
      },
      include: magicMcpGroupInclude
    });

    await magicMcpGroupUpdatedQueue.add({ magicMcpGroupId: magicMcpGroup.id });

    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.group.instanceOid }
    });

    await Fabric.fire('magic_mcp.group.updated:after', {
      instance,
      magicMcpGroup,
      previousMagicMcpGroup: { ...d.group, servers: magicMcpGroup.servers },
      auditScope: d.auditScope
    });

    return magicMcpGroup;
  }

  async listMagicMcpGroups(d: {
    search?: string;
    instance: Instance;
    status?: MagicMcpGroupStatus[];
  }) {
    let normalizedSearch = d.search?.trim();
    if (!normalizedSearch?.length) normalizedSearch = undefined;

    let searchedGroupIds = normalizedSearch
      ? await searchMagicMcpGroupIds({
          instanceId: d.instance.id,
          query: normalizedSearch
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpGroup.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            AND: [
              d.status
                ? { status: { in: d.status } }
                : { status: { notIn: ['archived', 'deleted'] as MagicMcpGroupStatus[] } },
              normalizedSearch ? { id: { in: searchedGroupIds } } : undefined!
            ].filter(Boolean)
          }
        });
      })
    );
  }

  async deleteMagicMcpGroup(d: { group: MagicMcpGroup; auditScope: AuditScope }) {
    if (d.group.status === 'deleted') {
      throw new ServiceError(
        goneError({
          message: 'This magic MCP group has been deleted'
        })
      );
    }

    if (d.group.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot delete a magic MCP group that is not active'
        })
      );
    }

    let deletedGroup = await withTransaction(async db => {
      let affectedTokenOids = (
        await db.magicMcpGroupToken.findMany({
          where: {
            magicMcpGroupOid: d.group.oid
          },
          select: {
            magicMcpTokenOid: true
          },
          distinct: ['magicMcpTokenOid']
        })
      ).map(link => link.magicMcpTokenOid);

      await db.magicMcpGroupServer.deleteMany({
        where: {
          magicMcpGroupOid: d.group.oid
        }
      });

      await db.magicMcpGroupToken.deleteMany({
        where: {
          magicMcpGroupOid: d.group.oid
        }
      });

      let deletedGroup = await db.magicMcpGroup.update({
        where: { id: d.group.id },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        }
      });

      if (affectedTokenOids.length > 0) {
        let linkedAfterDelete = (
          await db.magicMcpGroupToken.groupBy({
            by: ['magicMcpTokenOid'],
            where: {
              magicMcpTokenOid: {
                in: affectedTokenOids
              }
            }
          })
        ).map(entry => entry.magicMcpTokenOid);

        await db.magicMcpToken.updateMany({
          where: {
            oid: {
              in: affectedTokenOids
            }
          },
          data: {
            isGroupLocked: false
          }
        });

        if (linkedAfterDelete.length > 0) {
          await db.magicMcpToken.updateMany({
            where: {
              oid: {
                in: linkedAfterDelete
              }
            },
            data: {
              isGroupLocked: true
            }
          });
        }
      }

      return deletedGroup;
    });

    await magicMcpGroupDeletedQueue.add({ magicMcpGroupId: deletedGroup.id });

    await Fabric.fire('magic_mcp.group.deleted:after', {
      magicMcpGroup: { ...deletedGroup, servers: [] },
      auditScope: d.auditScope
    });

    return deletedGroup;
  }

  async addServersToGroup(d: {
    group: MagicMcpGroup;
    serverIds: string[];
    auditScope: AuditScope;
  }) {
    if (d.group.status === 'deleted') {
      throw new ServiceError(
        goneError({
          message: 'This magic MCP group has been deleted'
        })
      );
    }

    if (d.group.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot add servers to a magic MCP group that is not active'
        })
      );
    }

    let uniqueServerIds = [...new Set(d.serverIds)];
    let servers = await db.magicMcpServer.findMany({
      where: {
        id: { in: uniqueServerIds },
        instanceOid: d.group.instanceOid
      }
    });

    if (servers.length !== uniqueServerIds.length) {
      throw new ServiceError(notFoundError('magic_mcp.server'));
    }

    if (servers.some(server => server.status !== 'active')) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Magic MCP groups can only be linked to active magic MCP servers'
        })
      );
    }

    let existingServerOids = new Set(
      (
        await db.magicMcpGroupServer.findMany({
          where: {
            magicMcpGroupOid: d.group.oid,
            magicMcpServerOid: { in: servers.map(server => server.oid) }
          },
          select: { magicMcpServerOid: true }
        })
      ).map(link => link.magicMcpServerOid)
    );

    await db.magicMcpGroupServer.createMany({
      data: servers.map(s => ({
        magicMcpGroupOid: d.group.oid,
        magicMcpServerOid: s.oid
      })),
      skipDuplicates: true
    });

    await Fabric.fire('magic_mcp.group.servers.modified:after', {
      magicMcpGroup: await this.getMagicMcpGroupWithServers(d.group),
      operation: 'add',
      servers: servers
        .filter(server => !existingServerOids.has(server.oid))
        .map(server => ({ id: server.id, name: server.name })),
      auditScope: d.auditScope
    });

    return d.group;
  }

  private async getMagicMcpGroupWithServers(group: MagicMcpGroup) {
    return await db.magicMcpGroup.findUniqueOrThrow({
      where: { oid: group.oid },
      include: magicMcpGroupInclude
    });
  }

  async removeServersFromGroup(d: {
    group: MagicMcpGroup;
    serverIds: string[];
    auditScope: AuditScope;
  }) {
    if (d.group.status === 'deleted') {
      throw new ServiceError(
        goneError({
          message: 'This magic MCP group has been deleted'
        })
      );
    }

    let servers = await db.magicMcpServer.findMany({
      where: {
        id: { in: d.serverIds },
        instanceOid: d.group.instanceOid
      }
    });

    let removedServerOids = new Set(
      (
        await db.magicMcpGroupServer.findMany({
          where: {
            magicMcpGroupOid: d.group.oid,
            magicMcpServerOid: { in: servers.map(server => server.oid) }
          },
          select: { magicMcpServerOid: true }
        })
      ).map(link => link.magicMcpServerOid)
    );

    await db.magicMcpGroupServer.deleteMany({
      where: {
        magicMcpGroupOid: d.group.oid,
        magicMcpServerOid: { in: servers.map(s => s.oid) }
      }
    });

    await Fabric.fire('magic_mcp.group.servers.modified:after', {
      magicMcpGroup: await this.getMagicMcpGroupWithServers(d.group),
      operation: 'remove',
      servers: servers
        .filter(server => removedServerOids.has(server.oid))
        .map(server => ({ id: server.id, name: server.name })),
      auditScope: d.auditScope
    });

    return d.group;
  }

  async findManyGroupsById(d: { groupIds: string[]; instance: Instance }) {
    if (d.groupIds.length === 0) return [];

    let idSet = [...new Set(d.groupIds)];

    let groups = await db.magicMcpGroup.findMany({
      where: {
        id: { in: d.groupIds },
        instanceOid: d.instance.oid
      }
    });

    if (groups.length !== idSet.length) {
      throw new ServiceError(notFoundError('magic_mcp.group'));
    }

    if (groups.some(group => group.status !== 'active')) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Magic MCP tokens can only be linked to active magic MCP groups'
        })
      );
    }

    return groups;
  }
}

export let magicMcpGroupService = Service.create(
  'magicMcpGroup',
  () => new MagicMcpGroupImpl()
).build();
