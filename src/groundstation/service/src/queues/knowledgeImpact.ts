import { createQueue } from '@lowerdeck/queue';
import type { PriceOverrideTarget } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import {
  loadCorrectionImpacts,
  loadOverrideFilter,
  loadSnapshotImpacts,
  overrideImpact
} from '../knowledge/triggers';
import { priceOverrideRebuildReason } from '../rebuild/plan';
import { startCatalogRebuild } from '../rebuild/triggers';
import { startImpactRebuild } from './rebuild';

export type KnowledgeImpactJob =
  | { type: 'snapshot'; snapshotId: string }
  | { type: 'correction'; offeringId: string; from: string; to: string | null }
  | {
      type: 'override';
      organizationOid: string;
      projectOid: string | null;
      scopes: {
        target: PriceOverrideTarget;
        targetId: string | null;
        vendorId: string | null;
        validFrom: string;
        validTo: string | null;
      }[];
    };

export let knowledgeImpactQueue = createQueue<KnowledgeImpactJob>({
  name: 'gs/knowledge/impact',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let queueKnowledgeImpact = async (job: KnowledgeImpactJob) => {
  await knowledgeImpactQueue.add(
    job,
    job.type == 'snapshot' ? { id: `knowledge-impact-${job.snapshotId}` } : undefined
  );
};

// Knowledge impacts fan out to every organization with matching data through the rebuild
// organization queues; override impacts are scoped to their organization from the start.
export let processKnowledgeImpact = async (job: KnowledgeImpactJob, now = new Date()) => {
  if (job.type == 'snapshot') {
    let impacts = await loadSnapshotImpacts({ snapshotId: job.snapshotId, now });
    await startCatalogRebuild({ impacts });

    return { impacts };
  }

  if (job.type == 'correction') {
    let impacts = await loadCorrectionImpacts({
      offeringId: job.offeringId,
      from: new Date(job.from),
      to: job.to ? new Date(job.to) : null
    });
    await startCatalogRebuild({ impacts });

    return { impacts };
  }

  let organization = await db.organization.findUnique({
    where: { oid: BigInt(job.organizationOid) }
  });
  if (!organization || organization.archivedAt) return { impacts: [] };

  let project = job.projectOid
    ? await db.project.findUnique({ where: { oid: BigInt(job.projectOid) } })
    : null;

  let scopes = await Promise.all(
    job.scopes.map(async scope => ({
      filter: await loadOverrideFilter(scope),
      validFrom: new Date(scope.validFrom),
      validTo: scope.validTo ? new Date(scope.validTo) : null
    }))
  );
  let impact = overrideImpact(scopes);
  if (!impact) return { impacts: [] };

  let run = await startImpactRebuild({
    organization,
    project,
    impacts: [impact],
    reason: priceOverrideRebuildReason,
    now
  });

  return { impacts: [impact], run };
};

export let knowledgeImpactProcessor = knowledgeImpactQueue.process(async data => {
  await processKnowledgeImpact(data);
});
