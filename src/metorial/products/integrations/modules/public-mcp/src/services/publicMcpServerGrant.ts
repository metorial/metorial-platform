import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type PublicMcpServer,
  type PublicMcpServerGrant,
  type PublicMcpServerGrantRevocationReason,
  type PublicMcpServerGrantStatus,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter } from '@metorial-subspace/list-utils';
import { sessionService } from '@metorial-subspace/module-session';
import {
  checkTenant,
  getSubspaceSystemProviderEventBase,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { runWithPublicMcpAccess } from '@metorial-subspace/public-mcp-guard';
import { Fabric, type ProviderEventBase } from '@metorial/fabric';
import { addSeconds, startOfHour } from 'date-fns';
import { assertPublicMcpRateLimit } from '../internal/rateLimit';
import { PUBLIC_MCP_RATE_LIMITS } from '../lib/constants';
import { publicMcpGrantCleanupQueue } from '../queues/grantCleanup';

export let publicMcpServerGrantInclude = {
  publicMcpServer: true,
  client: true,
  deployment: true,
  config: true,
  authConfig: true,
  currentSession: true
};

let SLIDE_THROTTLE_MS = 60_000;

let toAuditGrant = async (grant: PublicMcpServerGrant) =>
  await db.publicMcpServerGrant.findUniqueOrThrow({
    where: { oid: grant.oid },
    include: { publicMcpServer: true, client: true }
  });

type ListPublicMcpServerGrantsParams = {
  publicMcpServer: PublicMcpServer;
  status?: PublicMcpServerGrantStatus[];
  ids?: string[];
  createdAt?: DateFilter;
};

type GetPublicMcpServerGrantByIdParams = {
  publicMcpServer: PublicMcpServer;
  publicMcpServerGrantId: string;
};

class publicMcpServerGrantServiceImpl {
  async listGrants(d: MetorialFacing<ListPublicMcpServerGrantsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listGrantsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listGrantsInternal(
    d: { tenant: Tenant; environment: Environment } & ListPublicMcpServerGrantsParams
  ) {
    checkTenant(d, d.publicMcpServer);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.publicMcpServerGrant.findMany({
            ...opts,
            where: {
              publicMcpServerOid: d.publicMcpServer.oid,
              status: d.status?.length ? { in: d.status } : { not: 'pending_exchange' },

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include: publicMcpServerGrantInclude
          })
      )
    );
  }

  async getGrantById(d: MetorialFacing<GetPublicMcpServerGrantByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getGrantByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getGrantByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetPublicMcpServerGrantByIdParams
  ) {
    checkTenant(d, d.publicMcpServer);

    let grant = await db.publicMcpServerGrant.findFirst({
      where: { id: d.publicMcpServerGrantId, publicMcpServerOid: d.publicMcpServer.oid },
      include: publicMcpServerGrantInclude
    });
    if (!grant) {
      throw new ServiceError(
        notFoundError('public_mcp_server.grant', d.publicMcpServerGrantId)
      );
    }

    return grant;
  }

  async countActiveGrants(d: { publicMcpServer: PublicMcpServer }) {
    return await db.publicMcpServerGrant.count({
      where: {
        publicMcpServerOid: d.publicMcpServer.oid,
        status: { in: ['active', 'pending_exchange'] }
      }
    });
  }

  async hasCapacity(d: { publicMcpServer: PublicMcpServer }) {
    if (!d.publicMcpServer.maxActiveGrants) return true;
    return (await this.countActiveGrants(d)) < d.publicMcpServer.maxActiveGrants;
  }

  async revokeGrant(
    d: MetorialFacing<{ publicMcpServer: PublicMcpServer; grant: PublicMcpServerGrant }>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    checkTenant(scope, d.publicMcpServer);

    if (d.grant.publicMcpServerOid !== d.publicMcpServer.oid) {
      throw new ServiceError(notFoundError('public_mcp_server.grant', d.grant.id));
    }
    if (d.grant.status === 'revoked' || d.grant.status === 'expired') {
      throw new ServiceError(badRequestError({ message: 'This grant is no longer active.' }));
    }

    return await this.revokeGrantInternal({
      grant: rest.grant,
      reason: 'owner_revoked',
      eventBase: toProviderEventBase(d)
    });
  }

  async revokeGrantInternal(d: {
    grant: PublicMcpServerGrant;
    reason: PublicMcpServerGrantRevocationReason;
    eventBase?: ProviderEventBase;
  }) {
    let eventBase =
      d.eventBase ??
      (await getSubspaceSystemProviderEventBase({
        job: 'subspace/publicMcpGrant',
        instanceOid: d.grant.instanceOid
      }));

    await Fabric.fire('provider.public_mcp_grant.revoked:before', eventBase);

    let status: PublicMcpServerGrantStatus =
      d.reason === 'idle_expired' || d.reason === 'exchange_expired' ? 'expired' : 'revoked';

    let grant = await withTransaction(async db => {
      let now = new Date();

      let updated = await db.publicMcpServerGrant.updateMany({
        where: { oid: d.grant.oid, status: { in: ['active', 'pending_exchange'] } },
        data: { status, revokedReason: d.reason, revokedAt: now }
      });

      await db.publicMcpServerToken.updateMany({
        where: { grantOid: d.grant.oid, revokedAt: null },
        data: { revokedAt: now }
      });

      if (updated.count) {
        await addAfterTransactionHook(async () =>
          publicMcpGrantCleanupQueue.add({ grantId: d.grant.id }, { id: d.grant.id })
        );
      }

      return await db.publicMcpServerGrant.findUniqueOrThrow({
        where: { oid: d.grant.oid },
        include: publicMcpServerGrantInclude
      });
    });

    await Fabric.fire('provider.public_mcp_grant.revoked:after', {
      ...eventBase,
      grant: await toAuditGrant(grant)
    });

    return grant;
  }

  async ensureGrantSession(d: { grant: PublicMcpServerGrant }) {
    return await runWithPublicMcpAccess(
      { publicMcpServerOid: d.grant.publicMcpServerOid, grantOid: d.grant.oid },
      async () => {
        let grant = await db.publicMcpServerGrant.findUniqueOrThrow({
          where: { oid: d.grant.oid },
          include: {
            ...publicMcpServerGrantInclude,
            tenant: true,
            environment: true
          }
        });

        if (grant.currentSession && grant.currentSession.status === 'active') {
          return grant.currentSession;
        }

        let session = await sessionService.createSessionInternal({
          tenant: grant.tenant,
          environment: grant.environment,
          input: {
            name: grant.publicMcpServer.name,
            metadata: { publicMcpServerId: grant.publicMcpServer.id, grantId: grant.id },
            providers: [
              {
                deploymentId: grant.deployment.id,
                configId: grant.config?.id,
                authConfigId: grant.authConfig?.id,
                toolFilters: grant.publicMcpServer.toolFilter,
                __allowEphemeral: true
              }
            ]
          }
        });

        let claimed = await withTransaction(async db => {
          await db.session.updateMany({
            where: { oid: session.oid },
            data: { ownerPublicMcpServerOid: grant.publicMcpServerOid }
          });
          await db.sessionProvider.updateMany({
            where: { sessionOid: session.oid },
            data: { ownerPublicMcpServerOid: grant.publicMcpServerOid }
          });

          let result = await db.publicMcpServerGrant.updateMany({
            where: { oid: grant.oid, currentSessionOid: grant.currentSessionOid ?? null },
            data: { currentSessionOid: session.oid }
          });

          return result.count > 0;
        });

        if (claimed) {
          return await db.session.findUniqueOrThrow({ where: { oid: session.oid } });
        }

        // A concurrent request won the race; drop ours and use the winner's session.
        await sessionService.archiveSessionInternal({
          tenant: grant.tenant,
          environment: grant.environment,
          session: await db.session.findUniqueOrThrow({ where: { oid: session.oid } })
        });

        let winner = await db.publicMcpServerGrant.findUniqueOrThrow({
          where: { oid: grant.oid },
          include: { currentSession: true }
        });

        return winner.currentSession!;
      }
    );
  }

  async recordUse(d: {
    grant: PublicMcpServerGrant;
    context: { ip: string; ua: string | null };
  }) {
    await assertPublicMcpRateLimit({
      key: `grant:${d.grant.oid}`,
      limit: PUBLIC_MCP_RATE_LIMITS.requestsPerGrant
    });

    let now = new Date();
    let hourBucket = startOfHour(now);

    let existing = await db.publicMcpServerGrantUse.findUnique({
      where: {
        grantOid_hourBucket_ip: { grantOid: d.grant.oid, hourBucket, ip: d.context.ip }
      },
      select: { oid: true }
    });

    if (existing) {
      await db.publicMcpServerGrantUse.update({
        where: { oid: existing.oid },
        data: { count: { increment: 1 }, ua: d.context.ua ?? undefined }
      });
    } else {
      let isFirstUseThisHour = !(await db.publicMcpServerGrantUse.findFirst({
        where: { grantOid: d.grant.oid, hourBucket },
        select: { oid: true }
      }));

      await db.publicMcpServerGrantUse.upsert({
        where: {
          grantOid_hourBucket_ip: { grantOid: d.grant.oid, hourBucket, ip: d.context.ip }
        },
        create: {
          ...getId('publicMcpServerGrantUse'),
          ip: d.context.ip,
          ua: d.context.ua,
          hourBucket,
          grantOid: d.grant.oid,
          projectOid: d.grant.projectOid,
          instanceOid: d.grant.instanceOid
        },
        update: { count: { increment: 1 } }
      });

      if (isFirstUseThisHour) {
        let tenant = await db.tenant.findUniqueOrThrow({
          where: { oid: d.grant.tenantOid },
          select: { id: true }
        });

        await Fabric.fire('provider.public_mcp_grant.used:after', {
          tenantId: tenant.id,
          instanceOid: d.grant.instanceOid,
          publicMcpServerOid: d.grant.publicMcpServerOid,
          grantId: d.grant.id,
          hourBucket
        });
      }
    }

    if (
      !d.grant.lastUsedAt ||
      now.getTime() - d.grant.lastUsedAt.getTime() > SLIDE_THROTTLE_MS
    ) {
      let publicMcpServer = await db.publicMcpServer.findUniqueOrThrow({
        where: { oid: d.grant.publicMcpServerOid },
        select: { grantIdleExpirySeconds: true }
      });

      await db.publicMcpServerGrant.updateMany({
        where: { oid: d.grant.oid, status: 'active' },
        data: {
          lastUsedAt: now,
          expiresAt: addSeconds(now, publicMcpServer.grantIdleExpirySeconds)
        }
      });
    }
  }
}

export let publicMcpServerGrantService = Service.create(
  'publicMcpServerGrant',
  () => new publicMcpServerGrantServiceImpl()
).build();
