import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, Instance, Prisma } from '@metorial/db';
import { consumerMagicMcpReadRoles, type AnyAccessTagSelector } from '@metorial/module-access';
import { getAccessTagFilter } from './consumerAccess';

let include = {
  magicMcpServer: {
    include: {
      aliases: true,
      consumerIntegrations: {
        include: {
          consumer: true,
          consumerProfile: true
        }
      },
      subspaceSession: true
    }
  },
  magicMcpEndpoint: {
    include: {
      consumerProfile: true,
      consumerIntegrationEndpoints: {
        include: {
          consumer: true,
          consumerProfile: true
        }
      },
      servers: {
        include: {
          magicMcpServer: {
            include: {
              aliases: true,
              consumerIntegrations: {
                include: {
                  consumer: true,
                  consumerProfile: true
                }
              },
              subspaceSession: true
            }
          }
        }
      },
      subspaceSession: true
    }
  },
  consumerIntegrationSessions: {
    include: {
      consumer: true,
      consumerProfile: true,
      consumerIntegration: {
        include: {
          consumer: true,
          consumerProfile: true
        }
      }
    }
  }
} satisfies Prisma.MagicMcpSessionInclude;

let getAccessWhere = (accessTagFilter: Awaited<ReturnType<typeof getAccessTagFilter>>) => {
  if (!accessTagFilter) return undefined;

  return {
    OR: [
      {
        magicMcpServer: {
          status: 'active' as const,
          accessTagEntities: accessTagFilter
        }
      },
      {
        magicMcpEndpoint: {
          status: 'active' as const,
          accessTagEntities: accessTagFilter
        }
      }
    ]
  } satisfies Prisma.MagicMcpSessionWhereInput;
};

class MagicMcpSessionImpl {
  async getMagicMcpSessionById(d: {
    instance: Instance;
    magicMcpSessionId: string;
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessTagFilter = await getAccessTagFilter({
      accessTags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles]
    });
    let accessWhere = getAccessWhere(accessTagFilter);

    let magicMcpSession = await db.magicMcpSession.findFirst({
      where: {
        id: d.magicMcpSessionId,
        instanceOid: d.instance.oid,
        AND: accessWhere ? [accessWhere] : undefined
      },
      include
    });
    if (!magicMcpSession) throw new ServiceError(notFoundError('magic_mcp.session'));

    return magicMcpSession;
  }

  async listMagicMcpSessions(d: {
    instance: Instance;
    magicMcpServerId?: string[];
    accessTags?: AnyAccessTagSelector;
  }) {
    let hasMagicMcpServerFilter = !!d.magicMcpServerId?.length;
    let magicMcpServerOids = hasMagicMcpServerFilter
      ? (
          await db.magicMcpServer.findMany({
            where: {
              id: { in: d.magicMcpServerId },
              instanceOid: d.instance.oid
            },
            select: {
              oid: true
            }
          })
        ).map(server => server.oid)
      : undefined;
    let magicMcpEndpointOids =
      hasMagicMcpServerFilter && magicMcpServerOids?.length
        ? await (
            await db.magicMcpEndpoint.findMany({
              where: {
                instanceOid: d.instance.oid,
                servers: {
                  some: {
                    magicMcpServerOid: { in: magicMcpServerOids }
                  }
                }
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
    let accessWhere = getAccessWhere(accessTagFilter);

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpSession.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            AND: [
              hasMagicMcpServerFilter
                ? {
                    OR: [
                      { magicMcpServerOid: { in: magicMcpServerOids ?? [] } },
                      { magicMcpEndpointOid: { in: magicMcpEndpointOids ?? [] } }
                    ]
                  }
                : undefined!,
              accessWhere ?? undefined!
            ].filter(Boolean)
          },
          include
        });
      })
    );
  }
}

export let magicMcpSessionService = Service.create(
  'magicMcpSession',
  () => new MagicMcpSessionImpl()
).build();
