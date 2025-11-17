import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import { Context } from '@metorial/context';
import {
  ConsumerProfile,
  ConsumerProfileGroup,
  db,
  ID,
  Instance,
  MagicMcpGroup,
  MagicMcpServer,
  MagicMcpToken,
  MagicMcpTokenStatus,
  Organization,
  OrganizationActor
} from '@metorial/db';
import {
  notFoundError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@metorial/error';
import { createLock } from '@metorial/lock';
import { consumerProfileService } from '@metorial/module-consumer';
import { organizationActorService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { subDays } from 'date-fns';

let include = {
  groups: {
    include: {
      magicMcpGroup: true
    }
  }
};

let autoCreateLock = createLock({
  name: 'mgc/tkn/acrk'
});

class MagicMcpTokenImpl {
  async getMagicMcpTokenById(d: {
    consumerProfile?: ConsumerProfile;
    instance: Instance;
    magicMcpTokenId: string;
  }) {
    let magicMcpToken = await db.magicMcpToken.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.magicMcpTokenId,
        consumerProfileOid: d.consumerProfile?.oid
      },
      include
    });
    if (!magicMcpToken) throw new ServiceError(notFoundError('magic_mcp.token'));

    return magicMcpToken;
  }

  async getMagicMcpTokenBySecret(d: { secret: string; instance: Instance }) {
    let magicMcpToken = await db.magicMcpToken.findFirst({
      where: {
        secret: d.secret,
        status: 'active',
        instanceOid: d.instance.oid
      },
      include: {
        instance: {
          include: { organization: true }
        }
      }
    });
    if (!magicMcpToken)
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid magic MCP token'
        })
      );

    return magicMcpToken;
  }

  async checkMagicMcpTokenAccess(d: { token: MagicMcpToken; server: MagicMcpServer }) {
    if (d.token.consumerProfileOid) {
      let consumerProfile = await db.consumerProfile.findFirstOrThrow({
        where: { oid: d.token.consumerProfileOid },
        include: { ssoUser: true }
      });

      let groups = await consumerProfileService.getGroupsForProfile({
        consumerProfile
      });

      let group = await db.magicMcpGroup.findFirst({
        where: {
          tokens: {
            some: {
              magicMcpTokenOid: d.token.oid
            }
          },
          consumerAccesses: {
            some: {
              consumerGroupOid: { in: groups.map(g => g.oid) }
            }
          }
        }
      });

      return !!group;
    }

    if (!d.token.isGroupLocked) return true;

    let group = await db.magicMcpGroup.findFirst({
      where: {
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

  async getManyMagicMcpTokens(d: { magicMcpTokenId: string[]; instance: Instance }) {
    if (d.magicMcpTokenId.length === 0) return [];

    return await db.magicMcpToken.findMany({
      where: {
        id: { in: d.magicMcpTokenId },
        instanceOid: d.instance.oid
      },
      include
    });
  }

  async createMagicMcpToken(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context?: Context;
    groups?: MagicMcpGroup[];
    consumerProfile?: ConsumerProfile;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    let groups = d.groups?.length
      ? await db.magicMcpGroup.findMany({
          where: {
            id: { in: d.groups.map(g => g.id) },
            instanceOid: d.instance.oid
          }
        })
      : undefined;

    return await db.magicMcpToken.create({
      data: {
        id: await ID.generateId('magicMcpToken'),
        secret: await UnifiedApiKey.create({
          type: 'magic_mcp_token_secret',
          config: { url: getConfig().urls.mcpUrl }
        }).toString(),
        status: 'active',
        instanceOid: d.instance.oid,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata || {},

        type: d.consumerProfile ? 'consumer' : 'default',
        consumerProfileOid: d.consumerProfile?.oid,

        isGroupLocked: !!groups?.length,
        groups: groups
          ? {
              createMany: {
                data: groups.map(g => ({
                  magicMcpGroupOid: g.oid
                }))
              }
            }
          : undefined
      },
      include
    });
  }

  async deleteMagicMcpToken(d: { token: MagicMcpToken }) {
    if (d.token.status === 'deleted') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server magic MCP token is already deleted'
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
          message: 'The server magic MCP token is deleted'
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
    consumerProfile?: ConsumerProfile;
  }) {
    let groups = d.groupIds?.length
      ? await db.magicMcpGroup.findMany({
          where: { id: { in: d.groupIds } }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let getRes = async () =>
          await await db.magicMcpToken.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              consumerProfileOid: d.consumerProfile?.oid,
              type: d.consumerProfile ? 'consumer' : 'default',

              groups: groups
                ? {
                    some: {
                      magicMcpGroupOid: { in: groups.map(g => g.oid) }
                    }
                  }
                : undefined,

              status: d.status ? { in: d.status } : undefined,

              OR: [{ deletedAt: null }, { deletedAt: { gt: subDays(new Date(), 3) } }]
            },
            include
          });

        let res = await getRes();

        if (!groups && res.filter(s => s.status == 'active').length == 0) {
          res = await autoCreateLock.usingLock(d.instance.id, async () => {
            let existingSevers = await db.magicMcpToken.count({
              where: { instanceOid: d.instance.oid, status: 'active' }
            });

            if (existingSevers == 0) {
              let org = await db.organization.findFirstOrThrow({
                where: { oid: d.instance.organizationOid }
              });

              await this.createMagicMcpToken({
                organization: org,
                performedBy: await organizationActorService.getSystemActor({
                  organization: org
                }),
                instance: d.instance,
                input: {
                  name: 'Default Token',
                  description: 'This token was automatically created for you.'
                }
              });
            }

            return await getRes();
          });
        }

        return res;
      })
    );
  }

  async addGroupsToToken(d: {
    token: MagicMcpToken;
    groupIds: string[];
    consumerProfile?: ConsumerProfile & { groups: ConsumerProfileGroup[] };
  }) {
    let groups = await db.magicMcpGroup.findMany({
      where: {
        id: { in: d.groupIds },
        instanceOid: d.token.instanceOid,

        consumerAccesses: d.consumerProfile
          ? {
              some: { consumerGroupOid: { in: d.consumerProfile.groups.map(g => g.groupOid) } }
            }
          : undefined
      }
    });

    await db.magicMcpGroupToken.createMany({
      data: groups.map(g => ({
        magicMcpTokenOid: d.token.oid,
        magicMcpGroupOid: g.oid
      })),
      skipDuplicates: true
    });

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: {
        isGroupLocked: true
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
