import {
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import {
  db,
  ID,
  Instance,
  MagicMcpGroup,
  MagicMcpServer,
  MagicMcpToken,
  MagicMcpTokenStatus
} from '@metorial/db';
import { env } from '../env';

let createMagicMcpSecret = () =>
  UnifiedApiKey.create({
    type: 'magic_mcp_token_secret',
    config: {
      url: getConfig().urls.apiUrl,
      instance: `v2-${env.service.METORIAL_REGION ?? 'ext'}`
    }
  }).toString();

let include = {
  groups: {
    include: {
      magicMcpGroup: true
    }
  }
};

class MagicMcpTokenImpl {
  async getMagicMcpTokenById(d: { instance: Instance; magicMcpTokenId: string }) {
    let magicMcpToken = await db.magicMcpToken.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.magicMcpTokenId
      },
      include
    });
    if (!magicMcpToken) throw new ServiceError(notFoundError('magic_mcp.token'));

    return magicMcpToken;
  }

  async createMagicMcpToken(d: {
    instance: Instance;
    groups?: MagicMcpGroup[];
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return await db.magicMcpToken.create({
      data: {
        id: await ID.generateId('magicMcpToken'),
        secret: createMagicMcpSecret(),
        status: 'active',
        isGroupLocked: !!d.groups?.length,
        instanceOid: d.instance.oid,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata ?? {},
        groups: d.groups?.length
          ? {
              createMany: {
                data: d.groups.map(g => ({
                  magicMcpGroupOid: g.oid
                }))
              }
            }
          : undefined
      },
      include
    });
  }

  async checkWriteAccess(d: { token: MagicMcpToken; instance: Instance }) {
    if (d.token.instanceOid !== d.instance.oid) {
      throw new ServiceError(notFoundError('magic_mcp.token'));
    }
  }

  async deleteMagicMcpToken(d: { token: MagicMcpToken }) {
    if (d.token.status === 'deleted') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP token is already deleted'
        })
      );
    }

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: { status: 'deleted', deletedAt: new Date() },
      include
    });
  }

  async updateMagicMcpToken(d: {
    token: MagicMcpToken;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, any> | null;
    };
  }) {
    if (d.token.status === 'deleted') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP token is deleted'
        })
      );
    }

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: {
        name: d.input.name === undefined ? d.token.name : d.input.name,
        description:
          d.input.description === undefined ? d.token.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.token.metadata : d.input.metadata
      },
      include
    });
  }

  async listMagicMcpTokens(d: {
    instance: Instance;
    status?: MagicMcpTokenStatus[];
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
        return await db.magicMcpToken.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: d.status ? { in: d.status } : undefined,
            groups: shouldFilterByGroups
              ? {
                  some: {
                    magicMcpGroupOid: { in: groupOids ?? [] }
                  }
                }
              : undefined
          },
          include
        });
      })
    );
  }

  async getMagicMcpTokenBySecret(d: { secret: string; instance: Instance }) {
    let magicMcpToken = await db.magicMcpToken.findFirst({
      where: {
        secret: d.secret,
        status: 'active',
        instanceOid: d.instance.oid
      },
      include
    });
    if (!magicMcpToken) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid magic MCP token'
        })
      );
    }

    return magicMcpToken;
  }

  async checkMagicMcpTokenAccess(d: { token: MagicMcpToken; server: MagicMcpServer }) {
    if (!d.token.isGroupLocked) return true;

    let group = await db.magicMcpGroup.findFirst({
      where: {
        status: 'active',
        servers: {
          some: {
            magicMcpServerOid: d.server.oid
          }
        },
        tokens: {
          some: {
            magicMcpTokenOid: d.token.oid
          }
        }
      }
    });

    return !!group;
  }

  async addGroupsToToken(d: { token: MagicMcpToken; groupIds: string[] }) {
    let groups = await db.magicMcpGroup.findMany({
      where: {
        id: { in: d.groupIds },
        instanceOid: d.token.instanceOid
      }
    });

    if (groups.length > 0) {
      await db.magicMcpGroupToken.createMany({
        data: groups.map(g => ({
          magicMcpTokenOid: d.token.oid,
          magicMcpGroupOid: g.oid
        })),
        skipDuplicates: true
      });
    }

    let otherGroups = await db.magicMcpGroupToken.count({
      where: { magicMcpTokenOid: d.token.oid }
    });

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: {
        isGroupLocked: otherGroups > 0
      },
      include
    });
  }

  async removeGroupsFromToken(d: { token: MagicMcpToken; groupIds: string[] }) {
    let groups = await db.magicMcpGroup.findMany({
      where: {
        id: { in: d.groupIds },
        instanceOid: d.token.instanceOid
      }
    });

    await db.magicMcpGroupToken.deleteMany({
      where: {
        magicMcpTokenOid: d.token.oid,
        magicMcpGroupOid: { in: groups.map(g => g.oid) }
      }
    });

    let otherGroups = await db.magicMcpGroupToken.count({
      where: { magicMcpTokenOid: d.token.oid }
    });

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: { isGroupLocked: otherGroups > 0 },
      include
    });
  }
}

export let magicMcpTokenService = Service.create(
  'magicMcpToken',
  () => new MagicMcpTokenImpl()
).build();
