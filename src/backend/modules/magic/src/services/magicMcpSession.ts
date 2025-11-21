import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { AccessTagSelectorList, accessTagService } from '@metorial/module-access';
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
    accessTags?: AccessTagSelectorList;
  }) {
    let magicMcpSession = await db.magicMcpSession.findFirst({
      where: {
        id: d.magicMcpSessionId,
        instanceOid: d.instance.oid,
        token: d.accessTags
          ? {
              accessTags: await accessTagService.getAccessTagFilter({
                tags: d.accessTags,
                level: 'read'
              })
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
    accessTags?: AccessTagSelectorList;
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

                d.accessTags
                  ? {
                      token: {
                        accessTags: await accessTagService.getAccessTagFilter({
                          tags: d.accessTags,
                          level: 'read'
                        })
                      }
                    }
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
