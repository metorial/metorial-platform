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
  MagicMcpTokenStatus,
  Prisma
} from '@metorial/db';
import {
  accessTagService,
  consumerMagicMcpConnectRoles,
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { env } from '../env';
import { getAccessTagFilter, getActiveStatusFilter } from './consumerAccess';

let createMagicMcpSecret = () =>
  UnifiedApiKey.create({
    type: 'magic_mcp_token_secret',
    config: {
      url: getConfig().urls.apiUrl,
      instance: `v2-${env.service.METORIAL_REGION ?? 'ext'}`
    }
  }).toString();

let include = {
  magicMcpServer: true,
  groups: {
    include: {
      magicMcpGroup: true
    }
  }
} satisfies Prisma.MagicMcpTokenInclude;

type MagicMcpTokenWithRelations = Prisma.MagicMcpTokenGetPayload<{
  include: typeof include;
}>;

class MagicMcpTokenImpl {
  async getMagicMcpTokenById(d: {
    instance: Instance;
    magicMcpTokenId: string;
    accessTags?: AnyAccessTagSelector;
  }): Promise<MagicMcpTokenWithRelations> {
    let magicMcpToken = await db.magicMcpToken.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.magicMcpTokenId,
        status: d.accessTags ? 'active' : undefined
      },
      include
    });
    if (!magicMcpToken) throw new ServiceError(notFoundError('magic_mcp.token'));

    if (d.accessTags) {
      await this.checkConsumerReadAccess({
        token: magicMcpToken,
        accessTags: d.accessTags
      });
    }

    return magicMcpToken;
  }

  async checkConsumerReadAccess(d: {
    token: MagicMcpToken;
    accessTags: AnyAccessTagSelector;
  }) {
    await accessTagService.checkResourceAccess({
      tags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles],
      checker: async filter => {
        return await db.magicMcpToken.findFirst({
          where: {
            oid: d.token.oid,
            accessTagEntities: filter
          }
        });
      }
    });
  }

  async createMagicMcpToken(d: {
    instance: Instance;
    groups?: MagicMcpGroup[];
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      magicMcpServer?: MagicMcpServer;
    };
  }) {
    return await db.magicMcpToken.create({
      data: {
        id: await ID.generateId('magicMcpToken'),
        secret: createMagicMcpSecret(),
        status: 'active',
        isGroupLocked: !!d.groups?.length,
        instanceOid: d.instance.oid,
        magicMcpServerOid: d.input.magicMcpServer?.oid,
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

  async checkWriteAccess(d: {
    token: MagicMcpToken;
    instance?: Instance;
    accessTags?: AnyAccessTagSelector;
  }) {
    if (d.accessTags) {
      await accessTagService.checkResourceAccess({
        tags: d.accessTags,
        roles: [...consumerMagicMcpWriteRoles],
        checker: async filter => {
          return await db.magicMcpToken.findFirst({
            where: {
              oid: d.token.oid,
              accessTagEntities: filter
            }
          });
        }
      });

      return;
    }

    if (!d.instance || d.token.instanceOid !== d.instance.oid) {
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
    serverIds?: string[];
    accessTags?: AnyAccessTagSelector;
  }) {
    let groupOids = !!d.groupIds?.length
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
    let serverOids = !!d.serverIds?.length
      ? (
          await db.magicMcpServer.findMany({
            where: {
              instanceOid: d.instance.oid,
              id: { in: d.serverIds }
            },
            select: { oid: true }
          })
        ).map(s => s.oid)
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
        return await db.magicMcpToken.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: statusFilter ? { in: statusFilter } : undefined,
            accessTagEntities: accessTagFilter,

            AND: [
              groupOids
                ? {
                    groups: {
                      some: {
                        magicMcpGroupOid: { in: groupOids }
                      }
                    }
                  }
                : undefined!,
              serverOids
                ? {
                    OR: [
                      {
                        magicMcpServerOid: { in: serverOids }
                      },
                      {
                        AND: [
                          {
                            magicMcpServerOid: null
                          },
                          {
                            groups: {
                              none: {}
                            }
                          }
                        ]
                      },
                      {
                        AND: [
                          {
                            magicMcpServerOid: null
                          },
                          {
                            groups: {
                              some: {
                                magicMcpGroup: {
                                  servers: {
                                    some: {
                                      magicMcpServerOid: { in: serverOids }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        ]
                      }
                    ]
                  }
                : undefined!
            ].filter(Boolean)
          },
          include
        });
      })
    );
  }

  async getMagicMcpTokenBySecret(d: {
    secret: string;
    instance: Instance;
  }): Promise<MagicMcpTokenWithRelations> {
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

  async checkMagicMcpTokenAccess(d: {
    token: MagicMcpTokenWithRelations;
    server: MagicMcpServer;
  }) {
    if (d.token.magicMcpServerOid && d.token.magicMcpServerOid !== d.server.oid) {
      return false;
    }

    if (d.token.isGroupLocked) {
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

      if (!group) return false;
    }

    let consumerAccessTagEntities = await db.accessTagEntity.findMany({
      where: {
        magicMcpTokenOid: d.token.oid,
        accessTagPolicy: {
          roles: {
            hasSome: [...consumerMagicMcpReadRoles, ...consumerMagicMcpConnectRoles]
          }
        }
      },
      select: {
        accessTagOid: true
      }
    });
    if (consumerAccessTagEntities.length == 0) return true;

    let serverAccess = await db.magicMcpServer.findFirst({
      where: {
        oid: d.server.oid,
        accessTagEntities: {
          some: {
            accessTagOid: {
              in: consumerAccessTagEntities.map(entity => entity.accessTagOid)
            },
            accessTagPolicy: {
              roles: {
                hasSome: [...consumerMagicMcpReadRoles]
              }
            }
          }
        }
      },
      select: {
        oid: true
      }
    });

    return !!serverAccess;
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
