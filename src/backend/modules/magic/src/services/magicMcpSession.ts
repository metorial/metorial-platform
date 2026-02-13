import { db, Instance, Prisma } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { AccessTagSelectorList, accessTagService } from '@metorial/module-access';
import {
  subspaceSessionConnectionService,
  subspaceSessionService
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  magicMcpServer: true
} satisfies Prisma.MagicMcpServerSubspaceSessionInclude;

type MagicMcpServerSubspaceSessionRow = Prisma.MagicMcpServerSubspaceSessionGetPayload<{
  include: typeof include;
}>;
type SubspaceSessionGetResult = Awaited<ReturnType<typeof subspaceSessionService.get>>;
type HydratedSubspaceSession = Pick<
  SubspaceSessionGetResult,
  'id' | 'connectionState' | 'usage' | 'createdAt' | 'updatedAt'
> & {
  lastActiveAt: Date | null;
};

class MagicMcpSessionImpl {
  private async hydrate(d: {
    instance: Instance;
    rows: MagicMcpServerSubspaceSessionRow[];
  }) {
    let organization = await db.organization.findFirstOrThrow({
      where: { oid: d.instance.organizationOid }
    });

    return await Promise.all(
      d.rows.map(async row => {
        let subspaceSession: HydratedSubspaceSession = await subspaceSessionService
          .get({
            instance: d.instance,
            organization,
            sessionId: row.subspaceSessionId
          })
          .then((session: SubspaceSessionGetResult) => ({
            id: session.id,
            connectionState: session.connectionState,
            usage: session.usage,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            lastActiveAt: session.lastActiveAt ?? null
          }))
          .catch(() => ({
            id: row.subspaceSessionId,
            connectionState: 'disconnected',
            usage: {
              totalProductiveClientMessageCount: 0,
              totalProductiveServerMessageCount: 0
            },
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            lastActiveAt: null
          }));

        let subspaceConnections = await subspaceSessionConnectionService
          .list({
            instance: d.instance,
            organization,
            sessionIds: [row.subspaceSessionId],
            limit: 100
          })
          .catch(() => ({
            items: []
          }));

        return {
          ...row,
          subspaceSession,
          connectionCount: subspaceConnections.items.length
        };
      })
    );
  }

  async getMagicMcpSessionById(d: {
    instance: Instance;
    magicMcpSessionId: string;
    accessTags?: AccessTagSelectorList;
  }) {
    let magicMcpSession = await db.magicMcpServerSubspaceSession.findFirst({
      where: {
        id: d.magicMcpSessionId,
        instanceOid: d.instance.oid,
        magicMcpServer: d.accessTags
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

    let [hydrated] = await this.hydrate({
      instance: d.instance,
      rows: [magicMcpSession]
    });

    return hydrated;
  }

  async listMagicMcpSessions(d: {
    instance: Instance;
    magicMcpServerId?: string[];
    accessTags?: AccessTagSelectorList;
  }) {
    let servers = d.magicMcpServerId?.length
      ? await db.magicMcpServer.findMany({
          where: { id: { in: d.magicMcpServerId }, instanceOid: d.instance.oid },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let rows = await db.magicMcpServerSubspaceSession.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,

            AND: [
              servers ? { magicMcpServerOid: { in: servers.map(s => s.oid) } } : undefined!,

              d.accessTags
                ? {
                    magicMcpServer: {
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
        });

        return await this.hydrate({
          instance: d.instance,
          rows
        });
      })
    );
  }

  async getManyMagicMcpSessions(d: { magicMcpSessionId: string[]; instance: Instance }) {
    if (d.magicMcpSessionId.length === 0) return [];

    let rows = await db.magicMcpServerSubspaceSession.findMany({
      where: {
        id: { in: d.magicMcpSessionId },
        instanceOid: d.instance.oid
      },
      include
    });

    return await this.hydrate({
      instance: d.instance,
      rows
    });
  }
}

export let magicMcpSessionService = Service.create(
  'magicMcpSession',
  () => new MagicMcpSessionImpl()
).build();
