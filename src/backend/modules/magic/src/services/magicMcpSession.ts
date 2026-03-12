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
      subspaceSession: true
    }
  }
} satisfies Prisma.MagicMcpServerSubspaceSessionInclude;

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

    let magicMcpSession = await db.magicMcpServerSubspaceSession.findFirst({
      where: {
        id: d.magicMcpSessionId,
        instanceOid: d.instance.oid,
        magicMcpServer: accessTagFilter
          ? {
              status: 'active',
              accessTagEntities: accessTagFilter
            }
          : undefined
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
    let accessTagFilter = await getAccessTagFilter({
      accessTags: d.accessTags,
      roles: [...consumerMagicMcpReadRoles]
    });

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpServerSubspaceSession.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            magicMcpServerOid: hasMagicMcpServerFilter
              ? { in: magicMcpServerOids ?? [] }
              : undefined,
            magicMcpServer: accessTagFilter
              ? {
                  status: 'active',
                  accessTagEntities: accessTagFilter
                }
              : undefined
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
