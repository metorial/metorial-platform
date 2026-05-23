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
} from '@mtsrc/error';
import { generatePlainId } from '@metorial/id';
import { searchMagicMcpGroupIds } from '@metorial/module-search';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { slugify } from '@mtsrc/slugify';
import {
  magicMcpGroupCreatedQueue,
  magicMcpGroupDeletedQueue,
  magicMcpGroupUpdatedQueue
} from '../queues/lifecycle/magicMcpGroup';

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
      }
    });

    await magicMcpGroupCreatedQueue.add({ magicMcpGroupId: magicMcpGroup.id });

    return magicMcpGroup;
  }

  async updateMagicMcpGroup(d: {
    group: MagicMcpGroup;
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
      }
    });

    await magicMcpGroupUpdatedQueue.add({ magicMcpGroupId: magicMcpGroup.id });

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

  async deleteMagicMcpGroup(d: { group: MagicMcpGroup }) {
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

    return deletedGroup;
  }

  async addServersToGroup(d: { group: MagicMcpGroup; serverIds: string[] }) {
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

    await db.magicMcpGroupServer.createMany({
      data: servers.map(s => ({
        magicMcpGroupOid: d.group.oid,
        magicMcpServerOid: s.oid
      })),
      skipDuplicates: true
    });

    return d.group;
  }

  async removeServersFromGroup(d: { group: MagicMcpGroup; serverIds: string[] }) {
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

    await db.magicMcpGroupServer.deleteMany({
      where: {
        magicMcpGroupOid: d.group.oid,
        magicMcpServerOid: { in: servers.map(s => s.oid) }
      }
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
