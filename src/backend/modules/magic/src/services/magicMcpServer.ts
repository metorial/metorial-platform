import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  MagicMcpServer,
  MagicMcpServerStatus,
  Organization,
  OrganizationActor,
  Prisma
} from '@metorial/db';
import {
  conflictError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@metorial/error';
import { generatePlainId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  aliases: true,
  subspaceSession: true
} satisfies Prisma.MagicMcpServerInclude;

type MagicMcpServerWithRelations = Prisma.MagicMcpServerGetPayload<{
  include: typeof include;
}>;

let toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

let buildAlias = (name?: string | null) => {
  let base = toSlug(name ?? '');
  if (base.length > 0) return `${base}-${generatePlainId(4)}`;

  return `magic-${generatePlainId(10)}`;
};

class MagicMcpServerImpl {
  async getMagicMcpServerById(d: { instance: Instance; magicMcpServerId: string }) {
    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        instanceOid: d.instance.oid,
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
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      sessionTemplateId: string;
    };
  }) {
    return await db.magicMcpServer.create({
      data: {
        id: await ID.generateId('magicMcpServer'),
        status: 'active',
        subspaceSessionTemplateId: d.input.sessionTemplateId,
        subspaceTenantId: d.instance.subspaceTenantId,
        subspaceEnvironmentId: d.instance.subspaceEnvironmentId,
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
      include
    });
  }

  async checkWriteAccess(d: { server: MagicMcpServer; instance: Instance }) {
    if (d.server.instanceOid !== d.instance.oid) {
      throw new ServiceError(notFoundError('magic_mcp.server'));
    }
  }

  async archiveMagicMcpServer(d: { server: MagicMcpServer }) {
    if (d.server.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP server is already archived'
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
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      aliases?: string[];
      sessionTemplateId?: string;
    };
  }) {
    if (d.server.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a magic MCP server that is not active'
        })
      );
    }

    let existingAliases = new Set(d.server.aliases.map(a => a.slug));
    let normalizedAliases =
      d.input.aliases?.map(alias => toSlug(alias)).filter(alias => alias.length > 0) ?? [];
    let nextAliases = [...new Set(normalizedAliases)].filter(alias => !existingAliases.has(alias));

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

    if (isSessionTemplateChanged && d.server.subspaceSession) {
      await db.magicMcpServerSubspaceSession
        .delete({
          where: {
            magicMcpServerOid: d.server.oid
          }
        })
        .catch(() => null);

      server = await db.magicMcpServer.findFirstOrThrow({
        where: { oid: d.server.oid },
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
  }) {
    let shouldFilterByGroups = !!d.groupIds?.length;
    let groupOids = shouldFilterByGroups
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

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpServer.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: d.status ? { in: d.status } : { not: 'archived' as const },
            groups: shouldFilterByGroups
              ? {
                  some: {
                    magicMcpGroupOid: { in: groupOids ?? [] }
                  }
                }
              : undefined,
            OR: d.search
              ? [
                  { id: { contains: d.search, mode: 'insensitive' } },
                  { name: { contains: d.search, mode: 'insensitive' } },
                  { description: { contains: d.search, mode: 'insensitive' } },
                  {
                    aliases: {
                      some: {
                        slug: { contains: d.search, mode: 'insensitive' }
                      }
                    }
                  }
                ]
              : undefined
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
