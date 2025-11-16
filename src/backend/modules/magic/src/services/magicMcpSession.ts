import { ConsumerProfile, db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  magicMcpServer: true,
  session: {
    include: {
      serverSessions: true
    }
  }
};

class MagicMcpSessionImpl {
  async getMagicMcpSessionById(d: {
    instance: Instance;
    magicMcpSessionId: string;
    consumerProfile?: ConsumerProfile;
  }) {
    let magicMcpSession = await db.magicMcpSession.findFirst({
      where: {
        id: d.magicMcpSessionId,
        instanceOid: d.instance.oid,
        token: d.consumerProfile ? { consumerProfileOid: d.consumerProfile?.oid } : undefined
      },
      include
    });
    if (!magicMcpSession) throw new ServiceError(notFoundError('magic_mcp.session'));

    return magicMcpSession;
  }

  async listMagicMcpSessions(d: {
    instance: Instance;
    magicMcpServerId?: string[];
    consumerProfile?: ConsumerProfile;
  }) {
    let servers = d.magicMcpServerId?.length
      ? await db.magicMcpServer.findMany({
          where: { id: { in: d.magicMcpServerId }, instanceOid: d.instance.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.magicMcpSession.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              AND: [
                servers ? { magicMcpServerOid: { in: servers.map(s => s.oid) } } : undefined!,

                d.consumerProfile
                  ? { token: { consumerProfileOid: d.consumerProfile?.oid } }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getManyMagicMcpSessions(d: { magicMcpSessionId: string[]; instance: Instance }) {
    if (d.magicMcpSessionId.length === 0) return [];

    return await db.magicMcpSession.findMany({
      where: {
        id: { in: d.magicMcpSessionId },
        instanceOid: d.instance.oid
      },
      include
    });
  }
}

export let magicMcpSessionService = Service.create(
  'magicMcpSession',
  () => new MagicMcpSessionImpl()
).build();
