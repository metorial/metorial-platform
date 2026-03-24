import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateVersion,
  SlateVersionDiscovery
} from '../../prisma/generated/client';
import { db } from '../db';
import { functionBay, functionBayTenant } from '../functionBay';

let include = {
  specification: {
    select: { id: true }
  },
  slateVersion: {
    include: {
      specification: true,
      slate: {
        include: {
          registry: true,
          currentVersion: {
            include: {
              specification: true
            }
          }
        }
      }
    }
  }
};

class slateVersionDiscoveryServiceImpl {
  async getSlateVersionDiscoveryById(d: { slateVersion: SlateVersion; id: string }) {
    let slateVersionDiscovery = await db.slateVersionDiscovery.findFirst({
      where: {
        slateVersionOid: d.slateVersion.oid,
        id: d.id
      },
      include
    });
    if (!slateVersionDiscovery)
      throw new ServiceError(notFoundError('slate.version_discovery'));
    return slateVersionDiscovery;
  }

  async getBuildOutput(d: { slateVersionDiscovery: SlateVersionDiscovery }) {
    if (!d.slateVersionDiscovery.invocationOid) return null;

    let invocation = await db.slateInvocation.findFirstOrThrow({
      where: {
        oid: d.slateVersionDiscovery.invocationOid
      }
    });

    if (!invocation.providerInvocationId) return null;

    let version = await db.slateVersion.findFirstOrThrow({
      where: {
        oid: d.slateVersionDiscovery.slateVersionOid
      }
    });
    if (!version.providerDeploymentInfo) {
      throw new ServiceError(badRequestError({ message: 'Version not deployed' }));
    }

    return await functionBay.functionInvocation.get({
      tenantId: (await functionBayTenant).id,
      functionId: version.providerDeploymentInfo.functionId,
      functionInvocationId: invocation.providerInvocationId
    });
  }

  async listSlateVersionDiscoveries(d: {
    slate?: Slate;
    versionIds?: string[];
    status?: 'succeeded' | 'failed';
  }) {
    let versions =
      d.slate || d.versionIds
        ? await db.slateVersion.findMany({
            where: {
              slateOid: d.slate?.oid,
              OR: d.versionIds
                ? [{ id: { in: d.versionIds } }, { version: { in: d.versionIds } }]
                : undefined
            },
            select: { oid: true }
          })
        : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersionDiscovery.findMany({
            ...opts,
            where: {
              slateVersionOid: versions ? { in: versions.map(v => v.oid) } : undefined,
              status: d.status
            },
            include
          })
      )
    );
  }

  async getToolCallStats(d: { slateVersionDiscovery: SlateVersionDiscovery }) {
    let slateVersion = await db.slateVersion.findFirstOrThrow({
      where: { oid: d.slateVersionDiscovery.slateVersionOid }
    });

    let toolCalls = await db.slateSessionToolCall.groupBy({
      by: ['actionOid', 'status'],
      where: { slateVersionOid: slateVersion.oid },
      _count: { _all: true }
    });

    let actionOids = [...new Set(toolCalls.map(tc => tc.actionOid))];
    let actions = await db.slateAction.findMany({
      where: { oid: { in: actionOids } }
    });

    let actionMap = new Map(actions.map(a => [Number(a.oid), a]));

    let stats: Record<string, { total: number; succeeded: number; failed: number }> = {};

    for (let tc of toolCalls) {
      let action = actionMap.get(Number(tc.actionOid));
      if (!action) continue;

      if (!stats[action.key]) {
        stats[action.key] = { total: 0, succeeded: 0, failed: 0 };
      }

      let stat = stats[action.key]!;
      stat.total += tc._count._all;
      if (tc.status === 'succeeded') {
        stat.succeeded += tc._count._all;
      } else {
        stat.failed += tc._count._all;
      }
    }

    let totalCalls = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
    let totalSucceeded = Object.values(stats).reduce((sum, s) => sum + s.succeeded, 0);
    let totalFailed = Object.values(stats).reduce((sum, s) => sum + s.failed, 0);

    return {
      total: totalCalls,
      succeeded: totalSucceeded,
      failed: totalFailed,
      byTool: stats
    };
  }
}

export let slateVersionDiscoveryService = Service.create(
  'slateVersionDiscoveryService',
  () => new slateVersionDiscoveryServiceImpl()
).build();
