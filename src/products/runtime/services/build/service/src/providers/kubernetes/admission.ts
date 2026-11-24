import { createLock } from '@lowerdeck/lock';
import type { WorkflowRun } from '../../../prisma/generated/client';
import { db, withTransaction } from '../../db';
import { env } from '../../env';

let admissionLock = createLock({
  name: 'frg/k8s/bld/admission',
  redisUrl: env.service.REDIS_URL
});

export let admitKubernetesBuild = async (
  run: Pick<WorkflowRun, 'oid' | 'providerOid'>,
  schedulingTimeoutMs: number,
  maxInFlight: number
) =>
  admissionLock.usingLock(run.providerOid.toString(), () =>
    withTransaction(async () => {
      let now = new Date();
      let cutoff = new Date(now.getTime() - schedulingTimeoutMs);
      let current = await db.workflowRun.findUniqueOrThrow({ where: { oid: run.oid } });
      let deadline =
        (current.kubernetesQueuedAt ?? current.createdAt).getTime() + schedulingTimeoutMs;

      if (current.status === 'failed' || current.status === 'succeeded') {
        return { status: 'finished' as const, deadline };
      }
      if (current.kubernetesAdmittedAt || current.status === 'running') {
        return { status: 'admitted' as const, deadline };
      }
      if (deadline <= now.getTime()) return { status: 'expired' as const, deadline };

      if (!current.kubernetesQueuedAt) {
        await db.workflowRun.update({
          where: { oid: run.oid },
          data: { kubernetesQueuedAt: current.createdAt }
        });
      }

      let inFlight = await db.workflowRun.count({
        where: {
          providerOid: run.providerOid,
          OR: [
            { status: 'running' },
            { status: 'pending', kubernetesAdmittedAt: { not: null } }
          ]
        }
      });
      if (inFlight >= maxInFlight) return { status: 'waiting' as const, deadline };

      let first = await db.workflowRun.findFirst({
        where: {
          providerOid: run.providerOid,
          status: 'pending',
          kubernetesQueuedAt: { gt: cutoff },
          kubernetesAdmittedAt: null
        },
        orderBy: [{ kubernetesQueuedAt: 'asc' }, { oid: 'asc' }],
        select: { oid: true }
      });
      if (first?.oid !== current.oid) return { status: 'waiting' as const, deadline };

      let admitted = await db.workflowRun.updateMany({
        where: { oid: run.oid, status: 'pending', kubernetesAdmittedAt: null },
        data: { kubernetesAdmittedAt: now }
      });
      return {
        status: admitted.count ? ('admitted' as const) : ('finished' as const),
        deadline
      };
    })
  );
