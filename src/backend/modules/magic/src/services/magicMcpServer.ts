import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  db,
  ID,
  Instance,
  MagicMcpServer,
  MagicMcpServerStatus,
  Organization,
  OrganizationActor,
  Prisma,
  withTransaction
} from '@metorial/db';
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { generateCode, generatePlainId } from '@metorial/id';
import { AccessTagSelectorList, accessTagService } from '@metorial/module-access';
import { searchService } from '@metorial/module-search';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { slugify } from '@metorial/slugify';
import { syncMagicMcpServerQueue } from '../queues/syncServer';
import { magicMcpSubspaceSessionService } from './magicMcpSubspaceSession';

let include = {
  aliases: true,
  subspaceSession: true
} satisfies Prisma.MagicMcpServerInclude;

type MagicMcpServerWithRelations = Prisma.MagicMcpServerGetPayload<{
  include: typeof include;
}>;

class MagicMcpServerImpl {
  async privateGetAccessTagFilterForReadAccess(d: { accessTags?: AccessTagSelectorList }) {
    return {
      accessTags: await accessTagService.getAccessTagFilter({
        tags: d.accessTags,
        level: 'read'
      })
    };
  }

  async getMagicMcpServerById(d: {
    accessTags?: AccessTagSelectorList;
    instance: Instance;
    magicMcpServerId: string;
  }) {
    let andFilters: Prisma.MagicMcpServerWhereInput[] = [
      {
        OR: [
          { id: d.magicMcpServerId },
          {
            aliases: {
              some: { slug: d.magicMcpServerId }
            }
          }
        ]
      }
    ];
    if (d.accessTags) {
      andFilters.push(
        await this.privateGetAccessTagFilterForReadAccess({ accessTags: d.accessTags })
      );
    }

    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        instanceOid: d.instance.oid,
        AND: andFilters
      },
      include
    });
    if (!magicMcpServer) throw new ServiceError(notFoundError('magic_mcp.server'));

    return magicMcpServer;
  }

  async DANGEROUSLY_getMagicMcpServerOnlyById(d: { magicMcpServerId: string }) {
    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        OR: [
          { id: d.magicMcpServerId },
          {
            aliases: {
              some: { slug: d.magicMcpServerId }
            }
          }
        ]
      },
      include: {
        ...include,
        instance: true
      }
    });
    if (!magicMcpServer) throw new ServiceError(notFoundError('magic_mcp.server'));

    return magicMcpServer;
  }

  async getManyMagicMcpServers(d: { magicMcpServerId: string[]; instance: Instance }) {
    if (d.magicMcpServerId.length === 0) return [];

    return await db.magicMcpServer.findMany({
      where: {
        id: { in: d.magicMcpServerId },
        instanceOid: d.instance.oid
      },
      include
    });
  }

  async createMagicMcpServer(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;

    consumer?: {
      profile: ConsumerProfile;
    };

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      sessionTemplateId: string;
    };
  }) {
    let slug = d.input.name
      ? await slugify(`${d.input.name}-${generateCode(5)}`)
      : generatePlainId(12);

    return withTransaction(async db => {
      let instanceSubspace = await db.instance.findUnique({
        where: { oid: d.instance.oid },
        select: {
          subspaceTenantId: true,
          subspaceEnvironmentId: true
        }
      });

      let createData: Prisma.MagicMcpServerCreateArgs['data'] = {
        id: await ID.generateId('magicMcpServer'),
        status: 'active',
        subspaceSessionTemplateId: d.input.sessionTemplateId,
        subspaceTenantId: instanceSubspace?.subspaceTenantId ?? d.instance.subspaceTenantId,
        subspaceEnvironmentId:
          instanceSubspace?.subspaceEnvironmentId ?? d.instance.subspaceEnvironmentId,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata ?? {},
        aliases: {
          create: { slug }
        },
        instance: {
          connect: { oid: d.instance.oid }
        },
        consumerProfile: d.consumer
          ? {
              connect: { oid: d.consumer.profile.oid }
            }
          : undefined,
        accessTags: d.consumer
          ? await accessTagService.linkAccessTagToEntity({
              tags: d.consumer.profile.accessTagOid,
              level: 'read_write'
            })
          : undefined
      };

      let server = await db.magicMcpServer.create({
        data: createData,
        include
      });

      await syncMagicMcpServerQueue.add({
        magicMcpServerId: server.id
      });

      return server;
    });
  }

  async checkWriteAccess(d: { server: MagicMcpServer; accessTags?: AccessTagSelectorList }) {
    await accessTagService.checkResourceAccess({
      tags: d.accessTags,
      level: 'read_write',
      checker: async filter =>
        await db.magicMcpServer.findFirst({
          where: {
            oid: d.server.oid,
            accessTags: filter
          },
          select: { oid: true }
        })
    });
  }

  async archiveMagicMcpServer(d: {
    server: MagicMcpServer;
    accessTags?: AccessTagSelectorList;
  }) {
    await this.checkWriteAccess({ server: d.server, accessTags: d.accessTags });

    if (d.server.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server magic MCP server is already archived'
        })
      );
    }

    return await db.magicMcpServer.update({
      where: { id: d.server.id },
      data: { status: 'archived', deletedAt: new Date() },
      include
    });
  }

  async updateMagicMcpServer(d: {
    server: MagicMcpServerWithRelations;
    accessTags?: AccessTagSelectorList;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      aliases?: string[];
      sessionTemplateId?: string;
    };
  }) {
    await this.checkWriteAccess({ server: d.server, accessTags: d.accessTags });

    if (d.server.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP server that is not active'
        })
      );
    }

    let existingAliases = d.server.aliases.map(a => a.slug);
    let newAliases = (d.input.aliases ?? [])?.filter(s => !existingAliases.includes(s));
    let nextSessionTemplateId =
      d.input.sessionTemplateId === undefined
        ? d.server.subspaceSessionTemplateId
        : d.input.sessionTemplateId;
    let isSessionTemplateChanged =
      nextSessionTemplateId !== d.server.subspaceSessionTemplateId;
    let previousSubspaceSession = d.server.subspaceSession;

    let updateData: Prisma.MagicMcpServerUpdateArgs['data'] = {
      name: d.input.name === undefined ? d.server.name : d.input.name,
      description:
        d.input.description === undefined ? d.server.description : d.input.description,
      metadata: d.input.metadata === undefined ? d.server.metadata : d.input.metadata,
      subspaceSessionTemplateId: nextSessionTemplateId,
      aliases: {
        create: newAliases.map(slug => ({
          slug: slug.includes(' ') ? slugify(slug) : slug
        }))
      }
    };

    let server = await db.magicMcpServer.update({
      where: { id: d.server.id },
      data: updateData,
      include
    });

    if (isSessionTemplateChanged && previousSubspaceSession) {
      await db.magicMcpServerSubspaceSession
        .delete({
          where: { magicMcpServerOid: d.server.oid }
        })
        .catch(() => null);

      let instance = await db.instance.findUnique({
        where: { oid: d.server.instanceOid },
        include: {
          organization: true
        }
      });
      if (instance) {
        await magicMcpSubspaceSessionService.cleanupSessionForTemplateChange({
          instance,
          organization: instance.organization,
          subspaceSessionId: previousSubspaceSession.subspaceSessionId,
          replacementSessionTemplateId: nextSessionTemplateId
        });
      }

      server = await db.magicMcpServer.findFirstOrThrow({
        where: { oid: d.server.oid },
        include
      });
    }

    await syncMagicMcpServerQueue.add({
      magicMcpServerId: server.id
    });

    return server;
  }

  async listMagicMcpServers(d: {
    groupIds?: string[];
    search?: string;
    instance: Instance;
    status?: MagicMcpServerStatus[];
    accessTags?: AccessTagSelectorList;
  }) {
    let search = d.search
      ? await searchService.search<{ id: string }>({
          index: 'magic_mcp_server',
          query: d.search,
          options: {
            filters: {
              instanceId: { $eq: d.instance.id }
            },
            limit: 50
          }
        })
      : undefined;

    let groups = d.groupIds?.length
      ? await db.magicMcpGroup.findMany({
          where: { id: { in: d.groupIds } },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let andFilters: Prisma.MagicMcpServerWhereInput[] = [
          d.status ? { status: { in: d.status } } : { status: { not: 'archived' as const } }
        ];
        if (groups) {
          andFilters.push({
            groups: {
              some: {
                magicMcpGroupOid: { in: groups.map(g => g.oid) }
              }
            }
          });
        }
        if (d.accessTags) {
          andFilters.push(
            await this.privateGetAccessTagFilterForReadAccess({
              accessTags: d.accessTags
            })
          );
        }

        let res = await db.magicMcpServer.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            AND: andFilters,
            id: search ? { in: search.map(s => s.id) } : undefined
          },
          include
        });

        return res;
      })
    );
  }
}

export let magicMcpServerService = Service.create(
  'magicMcpServer',
  () => new MagicMcpServerImpl()
).build();
