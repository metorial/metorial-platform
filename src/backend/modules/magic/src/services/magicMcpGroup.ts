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
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { generateCode } from '@metorial/id';
import { AccessTagSelectorList, accessTagService } from '@metorial/module-access';
import { searchService } from '@metorial/module-search';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { slugify } from '@metorial/slugify';
import { syncMagicMcpGroupQueue } from '../queues/syncGroup';

let include = {};

class MagicMcpGroupImpl {
  async getMagicMcpGroupById(d: {
    instance: Instance;
    magicMcpGroupId: string;
    accessTags?: AccessTagSelectorList;
  }) {
    let magicMcpGroup = await db.magicMcpGroup.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.magicMcpGroupId,

        accessTags: await accessTagService.getAccessTagFilter({
          tags: d.accessTags,
          level: 'read'
        })
      },
      include
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
    let slug = await slugify(`${d.input.name}-${generateCode(5)}`);

    return withTransaction(async db => {
      let group = await db.magicMcpGroup.create({
        data: {
          id: await ID.generateId('magicMcpGroup'),
          status: 'active',
          instanceOid: d.instance.oid,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata || {},
          slug
        },
        include
      });

      await syncMagicMcpGroupQueue.add({
        magicMcpGroupId: group.id
      });

      return group;
    });
  }

  async archiveMagicMcpGroup(d: { group: MagicMcpGroup }) {
    if (d.group.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The group magic MCP group is already archived'
        })
      );
    }

    return await db.magicMcpGroup.update({
      where: { id: d.group.id },
      data: { status: 'archived', deletedAt: new Date() },
      include
    });
  }

  async updateMagicMcpGroup(d: {
    group: MagicMcpGroup;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, any> | null;
    };
  }) {
    if (d.group.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP group that is not active'
        })
      );
    }

    let group = await db.magicMcpGroup.update({
      where: { id: d.group.id },
      data: {
        name: d.input.name === undefined ? d.group.name : d.input.name,
        description:
          d.input.description === undefined ? d.group.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.group.metadata : d.input.metadata
      },
      include
    });

    await syncMagicMcpGroupQueue.add({
      magicMcpGroupId: group.id
    });

    return group;
  }

  async listMagicMcpGroups(d: {
    search?: string;
    instance: Instance;
    status?: MagicMcpGroupStatus[];
    accessTags?: AccessTagSelectorList;
  }) {
    let search = d.search
      ? await searchService.search<{ id: string }>({
          index: 'magic_mcp_group',
          query: d.search,
          options: {
            filters: {
              instanceId: { $eq: d.instance.id }
            },
            limit: 50
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await await db.magicMcpGroup.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,

            accessTags: await accessTagService.getAccessTagFilter({
              tags: d.accessTags,
              level: 'read'
            }),

            AND: [
              d.status
                ? { status: { in: d.status } }
                : { status: { not: 'archived' as const } }
            ].filter(Boolean),

            id: search ? { in: search.map(s => s.id) } : undefined
          },
          include
        });

        if (res.length == 0) {
        }

        return res;
      })
    );
  }

  async deleteMagicMcpGroup(d: { group: MagicMcpGroup }) {
    if (d.group.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot delete a magic MCP group that is not active'
        })
      );
    }

    return await db.magicMcpGroup.delete({
      where: { id: d.group.id }
    });
  }

  async addServersToGroup(d: { group: MagicMcpGroup; serverIds: string[] }) {
    let servers = await db.magicMcpServer.findMany({
      where: {
        id: { in: d.serverIds },
        instanceOid: d.group.instanceOid
      }
    });

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

  async findManyGroupsById(d: {
    groupIds: string[];
    instance: Instance;
    accessTags?: AccessTagSelectorList;
  }) {
    if (d.groupIds.length === 0) return [];

    let idSet = [...new Set(d.groupIds)];

    let groups = await db.magicMcpGroup.findMany({
      where: {
        id: { in: d.groupIds },
        instanceOid: d.instance.oid,

        accessTags: await accessTagService.getAccessTagFilter({
          tags: d.accessTags,
          level: 'read'
        })
      },
      include
    });

    if (groups.length !== idSet.length) {
      throw new ServiceError(notFoundError('magic_mcp.group'));
    }

    return groups;
  }
}

export let magicMcpGroupService = Service.create(
  'magicMcpGroup',
  () => new MagicMcpGroupImpl()
).build();
