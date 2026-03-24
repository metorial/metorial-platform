import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Slate, SlateDeployment } from '../../prisma/generated/client';
import { db } from '../db';
import { functionBay, functionBayTenant } from '../functionBay';
import { deploySlateVersionQueue } from '../queues/deployment/deploy';

let include = {
  slate: {
    include: {
      registry: true,
      currentVersion: {
        include: {
          specification: true
        }
      }
    }
  },
  slateVersion: {
    include: {
      specification: true
    }
  }
};

class slateDeploymentServiceImpl {
  async getSlateDeploymentById(d: { slate: Slate; id: string }) {
    let slateDeployment = await db.slateDeployment.findFirst({
      where: {
        slateOid: d.slate.oid,
        id: d.id
      },
      include
    });
    if (!slateDeployment) throw new ServiceError(notFoundError('slate.deployment'));
    return slateDeployment;
  }

  async getBuildOutput(d: { slateDeployment: SlateDeployment }) {
    if (!d.slateDeployment.providerDeploymentInfo) {
      return [];
    }

    let res = await functionBay.functionDeployment.getOutput({
      tenantId: (await functionBayTenant).id,
      functionId: d.slateDeployment.providerDeploymentInfo.functionId,
      functionDeploymentId: d.slateDeployment.providerDeploymentInfo.functionDeploymentId
    });

    return res;
  }

  async getInternalLogs(d: { slateDeployment: SlateDeployment }) {
    return d.slateDeployment.internalLogs.map(entry => {
      try {
        return JSON.parse(entry);
      } catch {
        return { message: entry, args: [], ts: null };
      }
    });
  }

  async redeploy(d: { slateDeployment: SlateDeployment }) {
    let versionOid = d.slateDeployment.slateVersionOid;

    // Cancel all ongoing deployments for this version
    await db.slateDeployment.updateMany({
      where: {
        slateVersionOid: versionOid,
        status: { in: ['pending', 'running'] }
      },
      data: {
        isCancelledByRedeploy: true,
        status: 'failed',
        errorCode: 'cancelled_by_redeploy',
        errorMessage: 'Cancelled by redeploy'
      }
    });

    // Find the version to queue a new deployment
    let version = await db.slateVersion.findUniqueOrThrow({
      where: { oid: versionOid }
    });

    await deploySlateVersionQueue.add({ versionId: version.id });
  }

  async listSlateDeployments(d: {
    slate?: Slate;
    versionIds?: string[];
    status?: 'pending' | 'running' | 'succeeded' | 'failed';
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
          await db.slateDeployment.findMany({
            ...opts,
            where: {
              slateOid: d.slate?.oid,
              slateVersionOid: versions ? { in: versions.map(v => v.oid) } : undefined,
              status: d.status
            },
            include
          })
      )
    );
  }
}

export let slateDeploymentService = Service.create(
  'slateDeploymentService',
  () => new slateDeploymentServiceImpl()
).build();
