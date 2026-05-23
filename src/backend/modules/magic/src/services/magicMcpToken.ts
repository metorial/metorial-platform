import {
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import {
  db,
  ID,
  Instance,
  MagicMcpEndpoint,
  MagicMcpGroup,
  MagicMcpServer,
  MagicMcpToken,
  MagicMcpTokenStatus,
  Prisma
} from '@metorial/db';
import {
  accessTagService,
  consumerMagicMcpReadRoles,
  consumerMagicMcpWriteRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { startOfHour } from 'date-fns';
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
  consumerTokens: {
    include: {
      consumer: true,
      consumerProfile: true
    }
  },
  magicMcpServer: true,
  magicMcpEndpoint: {
    include: {
      servers: true
    }
  },
  skillPlugin: true,
  groups: {
    include: {
      magicMcpGroup: true
    }
  }
} satisfies Prisma.MagicMcpTokenInclude;

type MagicMcpTokenWithRelations = Prisma.MagicMcpTokenGetPayload<{
  include: typeof include;
}>;

let isMagicMcpTokenExpired = (token: Pick<MagicMcpToken, 'expiresAt'>) => {
  return !!token.expiresAt && token.expiresAt < new Date();
};

let getInactiveLinkedResourceMessage = (resource: 'server' | 'endpoint' | 'group') => {
  if (resource == 'server') {
    return 'The magic MCP token is linked to a magic MCP server that is no longer active';
  }

  if (resource == 'endpoint') {
    return 'The magic MCP token is linked to a magic MCP endpoint that is no longer active';
  }

  return 'The magic MCP token is linked to a magic MCP group that is no longer active';
};

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
      expiresAt?: Date | null;
      magicMcpServer?: MagicMcpServer;
      magicMcpEndpoint?: MagicMcpEndpoint;
      skillPlugin?: { oid: bigint } | null;
    };
  }) {
    if (d.input.magicMcpServer && d.input.magicMcpEndpoint) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'A magic MCP token can only be linked to one server or one endpoint'
        })
      );
    }

    await this.ensureLinkedResourcesAreActive({
      groups: d.groups,
      magicMcpServer: d.input.magicMcpServer,
      magicMcpEndpoint: d.input.magicMcpEndpoint
    });

    return await db.magicMcpToken.create({
      data: {
        id: await ID.generateId('magicMcpToken'),
        secret: createMagicMcpSecret(),
        status: 'active',
        isGroupLocked: !!d.groups?.length,
        isConsumerReconciled: true,
        instanceOid: d.instance.oid,
        magicMcpServerOid: d.input.magicMcpServer?.oid,
        magicMcpEndpointOid: d.input.magicMcpEndpoint?.oid,
        skillPluginOid: d.input.skillPlugin?.oid,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata ?? {},
        expiresAt: d.input.expiresAt,
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

  async rotateMagicMcpTokenSecret(d: {
    token: MagicMcpToken;
    expiresAt?: Date | null;
  }): Promise<MagicMcpTokenWithRelations> {
    if (d.token.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The magic MCP token must be active to rotate its secret'
        })
      );
    }

    let invalidLinkedResourceMessage = await this.getInvalidLinkedResourceMessage({
      token: d.token
    });
    if (invalidLinkedResourceMessage) {
      throw new ServiceError(
        preconditionFailedError({
          message: invalidLinkedResourceMessage
        })
      );
    }

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: {
        secret: createMagicMcpSecret(),
        expiresAt: d.expiresAt === undefined ? d.token.expiresAt : d.expiresAt
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
    endpointIds?: string[];
    accessTags?: AnyAccessTagSelector;
    filterAccessTags?: AnyAccessTagSelector;
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
    let endpointOids = !!d.endpointIds?.length
      ? (
          await db.magicMcpEndpoint.findMany({
            where: {
              instanceOid: d.instance.oid,
              id: { in: d.endpointIds }
            },
            select: {
              oid: true
            }
          })
        ).map(endpoint => endpoint.oid)
      : undefined;

    let accessTagFilter = await getAccessTagFilter({
      accessTags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    let filterAccessTagFilter = await getAccessTagFilter({
      accessTags: d.filterAccessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    let statusFilter = getActiveStatusFilter({
      accessTags: d.accessTags,
      status: d.status,
      activeStatus: 'active'
    });
    let defaultAccessTagFilter =
      !accessTagFilter && !filterAccessTagFilter
        ? {
            none: {}
          }
        : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpToken.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: statusFilter ? { in: statusFilter } : undefined,
            accessTagEntities:
              accessTagFilter ?? filterAccessTagFilter ?? defaultAccessTagFilter,

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
                : undefined!,
              endpointOids
                ? {
                    magicMcpEndpointOid: { in: endpointOids }
                  }
                : undefined!
            ].filter(Boolean)
          },
          include
        });
      })
    );
  }

  async getMagicMcpTokenBySecretSafe(d: {
    secret: string;
    instance: Instance;
  }): Promise<MagicMcpTokenWithRelations | null> {
    let magicMcpToken = await db.magicMcpToken.findFirst({
      where: {
        secret: d.secret,
        status: 'active',
        instanceOid: d.instance.oid
      },
      include
    });
    if (!magicMcpToken) return null;

    if (isMagicMcpTokenExpired(magicMcpToken)) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Magic MCP token has expired'
        })
      );
    }

    let invalidLinkedResourceMessage = await this.getInvalidLinkedResourceMessage({
      token: magicMcpToken
    });
    if (invalidLinkedResourceMessage) {
      throw new ServiceError(
        unauthorizedError({
          message: invalidLinkedResourceMessage
        })
      );
    }

    return magicMcpToken;
  }

  async getMagicMcpTokenBySecret(d: {
    secret: string;
    instance: Instance;
  }): Promise<MagicMcpTokenWithRelations> {
    let magicMcpToken = await this.getMagicMcpTokenBySecretSafe(d);
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
    server?: MagicMcpServer;
    endpoint?: Pick<MagicMcpEndpoint, 'oid' | 'status'>;
  }) {
    if (!d.server && !d.endpoint) {
      throw new Error('Magic MCP token access requires a server or endpoint');
    }

    if (d.server) {
      if (d.server.status !== 'active') {
        return false;
      }

      if (d.token.magicMcpEndpointOid) {
        return false;
      }

      if (d.token.magicMcpServerOid && d.token.magicMcpServerOid !== d.server.oid) {
        return false;
      }
    }

    if (d.endpoint) {
      if (d.endpoint.status !== 'active') {
        return false;
      }

      if (d.token.magicMcpServerOid) {
        return false;
      }

      if (d.token.magicMcpEndpointOid && d.token.magicMcpEndpointOid !== d.endpoint.oid) {
        return false;
      }
    }

    if (d.token.isGroupLocked) {
      if (d.server) {
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

      if (d.endpoint) {
        let uncoveredServerCount = await db.magicMcpEndpointServer.count({
          where: {
            magicMcpEndpointOid: d.endpoint.oid,
            magicMcpServer: {
              status: 'active',
              groups: {
                none: {
                  magicMcpGroup: {
                    status: 'active',
                    tokens: {
                      some: {
                        magicMcpTokenOid: d.token.oid
                      }
                    }
                  }
                }
              }
            }
          }
        });

        if (uncoveredServerCount > 0) return false;
      }
    }

    let consumerAccessTagEntities = await db.accessTagEntity.findMany({
      where: {
        magicMcpTokenOid: d.token.oid
        // accessTagPolicy: {
        //   roles: {
        //     hasSome: [...consumerMagicMcpReadRoles, ...consumerMagicMcpConnectRoles]
        //   }
        // }
      },
      select: {
        accessTagOid: true
      }
    });
    if (consumerAccessTagEntities.length == 0) return true;

    if (d.server) {
      let serverAccess = await db.magicMcpServer.findFirst({
        where: {
          oid: d.server.oid,
          status: 'active',
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

    let endpointAccess = await db.magicMcpEndpoint.findFirst({
      where: {
        oid: d.endpoint!.oid,
        status: 'active',
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

    return !!endpointAccess;
  }

  async recordMagicMcpTokenUse(d: {
    token: MagicMcpToken;
    server?: MagicMcpServer;
    endpoint?: MagicMcpEndpoint;
    ip?: string | null;
    ua?: string | null;
  }) {
    if ((!d.server && !d.endpoint) || (d.server && d.endpoint)) {
      throw new Error('Magic MCP token use requires exactly one server or endpoint');
    }

    await db.magicMcpTokenUse.createMany({
      data: [
        {
          magicMcpTokenOid: d.token.oid,
          magicMcpServerOid: d.server?.oid,
          magicMcpEndpointOid: d.endpoint?.oid,
          magicMcpTarget: d.server
            ? `s${d.server.oid.toString(36)}`
            : `e${d.endpoint!.oid.toString(36)}`,
          ip: d.ip ?? '',
          ua: d.ua ?? '',
          hour: startOfHour(new Date())
        }
      ],
      skipDuplicates: true
    });
  }

  async addGroupsToToken(d: { token: MagicMcpToken; groupIds: string[] }) {
    this.assetTokenNotServerOrEndpointLinked(d.token);

    let uniqueGroupIds = [...new Set(d.groupIds)];
    let groups = await db.magicMcpGroup.findMany({
      where: {
        id: { in: uniqueGroupIds },
        instanceOid: d.token.instanceOid
      }
    });

    if (groups.length !== uniqueGroupIds.length) {
      throw new ServiceError(notFoundError('magic_mcp.group'));
    }

    await this.ensureLinkedResourcesAreActive({
      groups
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
    this.assetTokenNotServerOrEndpointLinked(d.token);

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

  private assetTokenNotServerOrEndpointLinked(token: MagicMcpToken) {
    if (token.magicMcpServerOid || token.magicMcpEndpointOid) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'This operation is not allowed for tokens linked to a server or endpoint'
        })
      );
    }
  }

  private async ensureLinkedResourcesAreActive(d: {
    groups?: Pick<MagicMcpGroup, 'status'>[];
    magicMcpServer?: Pick<MagicMcpServer, 'status'> | null;
    magicMcpEndpoint?: Pick<MagicMcpEndpoint, 'oid' | 'status'> | null;
  }) {
    if (d.groups?.some(group => group.status !== 'active')) {
      throw new ServiceError(
        preconditionFailedError({
          message: getInactiveLinkedResourceMessage('group')
        })
      );
    }

    if (d.magicMcpServer && d.magicMcpServer.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: getInactiveLinkedResourceMessage('server')
        })
      );
    }

    if (d.magicMcpEndpoint) {
      if (d.magicMcpEndpoint.status !== 'active') {
        throw new ServiceError(
          preconditionFailedError({
            message: getInactiveLinkedResourceMessage('endpoint')
          })
        );
      }

      let inactiveServerCount = await db.magicMcpEndpointServer.count({
        where: {
          magicMcpEndpointOid: d.magicMcpEndpoint.oid,
          magicMcpServer: {
            status: {
              not: 'active'
            }
          }
        }
      });

      if (inactiveServerCount > 0) {
        throw new ServiceError(
          preconditionFailedError({
            message:
              'The magic MCP endpoint is linked to one or more magic MCP servers that are no longer active'
          })
        );
      }
    }
  }

  private async getInvalidLinkedResourceMessage(d: {
    token: Pick<
      MagicMcpToken,
      'oid' | 'magicMcpServerOid' | 'magicMcpEndpointOid' | 'isGroupLocked'
    >;
  }) {
    if (d.token.magicMcpServerOid) {
      let magicMcpServer = await db.magicMcpServer.findUnique({
        where: { oid: d.token.magicMcpServerOid },
        select: { status: true }
      });

      if (!magicMcpServer || magicMcpServer.status !== 'active') {
        return getInactiveLinkedResourceMessage('server');
      }
    }

    if (d.token.magicMcpEndpointOid) {
      let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
        where: { oid: d.token.magicMcpEndpointOid },
        select: {
          oid: true,
          status: true
        }
      });

      if (!magicMcpEndpoint || magicMcpEndpoint.status !== 'active') {
        return getInactiveLinkedResourceMessage('endpoint');
      }

      let inactiveEndpointServerCount = await db.magicMcpEndpointServer.count({
        where: {
          magicMcpEndpointOid: magicMcpEndpoint.oid,
          magicMcpServer: {
            status: {
              not: 'active'
            }
          }
        }
      });

      if (inactiveEndpointServerCount > 0) {
        return 'The magic MCP token is linked to a magic MCP endpoint with one or more inactive servers';
      }
    }

    if (d.token.isGroupLocked) {
      let inactiveGroupCount = await db.magicMcpGroupToken.count({
        where: {
          magicMcpTokenOid: d.token.oid,
          magicMcpGroup: {
            status: {
              not: 'active'
            }
          }
        }
      });

      if (inactiveGroupCount > 0) {
        return getInactiveLinkedResourceMessage('group');
      }
    }

    return null;
  }
}

export let magicMcpTokenService = Service.create(
  'magicMcpToken',
  () => new MagicMcpTokenImpl()
).build();
