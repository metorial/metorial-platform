import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  MagicMcpServer,
  MagicMcpServerAlias,
  MagicMcpServerStatus,
  Organization,
  OrganizationActor,
  ServerDeployment,
  ServerOAuthSession,
  withTransaction
} from '@metorial/db';
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { generateCode } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { slugify } from '@metorial/slugify';

let include = {
  serverDeployment: {
    include: {
      serverDeployment: {
        include: {
          server: true,
          serverImplementation: true
        }
      }
    }
  },
  defaultServerOauthSession: true,
  aliases: true
};

class MagicMcpServerImpl {
  async getMagicMcpServerById(d: { instance: Instance; magicMcpServerId: string }) {
    let magicMcpServer = await db.magicMcpServer.findFirst({
      where: {
        instanceOid: d.instance.oid,

        OR: [
          { id: d.magicMcpServerId },
          {
            aliases: {
              some: { slug: d.magicMcpServerId }
            }
          }
        ]
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

    serverDeployment: ServerDeployment;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    let slug = await slugify(`${d.input.name}-${generateCode(5)}`);

    return withTransaction(async db => {
      return await db.magicMcpServer.create({
        data: {
          id: await ID.generateId('magicMcpServer'),
          status: 'active',
          serverDeployment: {
            create: {
              id: await ID.generateId('magicMcpServerDeployment'),
              serverDeploymentOid: d.serverDeployment.oid
            }
          },
          instanceOid: d.instance.oid,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata || {},
          aliases: {
            create: { slug }
          }
        },
        include
      });
    });
  }

  async archiveMagicMcpServer(d: { server: MagicMcpServer }) {
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
    server: MagicMcpServer & { aliases: MagicMcpServerAlias[] };
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, any> | null;
      aliases?: string[];
      defaultOauthSession?: ServerOAuthSession;
    };
  }) {
    if (d.server.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server magic MCP server is archived'
        })
      );
    }

    let existingAliases = d.server.aliases.map(a => a.slug);
    let newAliases = (d.input.aliases ?? [])?.filter(s => !existingAliases.includes(s));

    return await db.magicMcpServer.update({
      where: { id: d.server.id },
      data: {
        name: d.input.name === undefined ? d.server.name : d.input.name,
        description:
          d.input.description === undefined ? d.server.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.server.metadata : d.input.metadata,

        defaultServerOauthSessionOid: d.input.defaultOauthSession?.oid,

        aliases: {
          create: newAliases.map(slug => ({
            slug: slug.includes(' ') ? slugify(slug) : slug
          }))
        }
      },
      include
    });
  }

  async listMagicMcpServers(d: { instance: Instance; status?: MagicMcpServerStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await await db.magicMcpServer.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,

            AND: [
              d.status
                ? { status: { in: d.status } }
                : { status: { not: 'archived' as const } }
            ].filter(Boolean)
          },
          include
        });

        if (res.length == 0) {
        }

        return res;
      })
    );
  }
}

export let magicMcpServerService = Service.create(
  'magicMcpServer',
  () => new MagicMcpServerImpl()
).build();
