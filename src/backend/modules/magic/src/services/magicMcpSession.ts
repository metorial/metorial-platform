import { db, Instance, Prisma } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  magicMcpServer: {
    include: {
      aliases: true,
      subspaceSession: true
    }
  }
} satisfies Prisma.MagicMcpServerSubspaceSessionInclude;

class MagicMcpSessionImpl {
  async getMagicMcpSessionById(d: { instance: Instance; magicMcpSessionId: string }) {
    let magicMcpSession = await db.magicMcpServerSubspaceSession.findFirst({
      where: {
        id: d.magicMcpSessionId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!magicMcpSession) throw new ServiceError(notFoundError('magic_mcp.session'));

    return magicMcpSession;
  }

  async listMagicMcpSessions(d: { instance: Instance; magicMcpServerId?: string[] }) {
    let magicMcpServerOids = d.magicMcpServerId?.length
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

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.magicMcpServerSubspaceSession.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            magicMcpServerOid: magicMcpServerOids
              ? {
                  in: magicMcpServerOids
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
