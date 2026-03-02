import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  MagicMcpGroup,
  MagicMcpGroupStatus,
  Organization,
  OrganizationActor
} from '@metorial/db';
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { generatePlainId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {};

let toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

class MagicMcpGroupImpl {
  async getMagicMcpGroupById(d: { instance: Instance; magicMcpGroupId: string }) {
    let magicMcpGroup = await db.magicMcpGroup.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.magicMcpGroupId
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
    let slug = `${toSlug(d.input.name ?? 'group')}-${generatePlainId(6).toLowerCase()}`;

    return await db.magicMcpGroup.create({
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

    return await db.magicMcpGroup.update({
      where: { id: d.group.id },
      data: {
        name: d.input.name === undefined ? d.group.name : d.input.name,
        description:
          d.input.description === undefined ? d.group.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.group.metadata : d.input.metadata
      },
      include
    });
  }

  async listMagicMcpGroups(d: {
    search?: string;
    instance: Instance;
    status?: MagicMcpGroupStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpGroup.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            AND: [
              d.status
                ? { status: { in: d.status } }
                : { status: { not: 'archived' as const } }
            ].filter(Boolean),
            OR: d.search
              ? [
                  { id: { contains: d.search, mode: 'insensitive' } },
                  { name: { contains: d.search, mode: 'insensitive' } },
                  { description: { contains: d.search, mode: 'insensitive' } },
                  { slug: { contains: d.search, mode: 'insensitive' } }
                ]
              : undefined
          },
          include
        });
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

    return await db.$transaction(async tx => {
      let affectedTokenOids = (
        await tx.magicMcpGroupToken.findMany({
          where: {
            magicMcpGroupOid: d.group.oid
          },
          select: {
            magicMcpTokenOid: true
          },
          distinct: ['magicMcpTokenOid']
        })
      ).map(link => link.magicMcpTokenOid);

      let deletedGroup = await tx.magicMcpGroup.delete({
        where: { id: d.group.id }
      });

      if (affectedTokenOids.length > 0) {
        let linkedAfterDelete = (
          await tx.magicMcpGroupToken.groupBy({
            by: ['magicMcpTokenOid'],
            where: {
              magicMcpTokenOid: {
                in: affectedTokenOids
              }
            }
          })
        ).map(entry => entry.magicMcpTokenOid);

        await tx.magicMcpToken.updateMany({
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
          await tx.magicMcpToken.updateMany({
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

  async findManyGroupsById(d: { groupIds: string[]; instance: Instance }) {
    if (d.groupIds.length === 0) return [];

    let idSet = [...new Set(d.groupIds)];

    let groups = await db.magicMcpGroup.findMany({
      where: {
        id: { in: d.groupIds },
        instanceOid: d.instance.oid
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
