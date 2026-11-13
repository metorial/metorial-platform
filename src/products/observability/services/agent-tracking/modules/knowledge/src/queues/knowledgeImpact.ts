import { createQueue } from '@lowerdeck/queue';
import type { PriceOverrideTarget } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import {
  loadCorrectionImpacts,
  loadOverrideFilter,
  loadSnapshotImpacts,
  overrideImpact
} from '../lib/triggers';
import { Events } from '@mtsrc/agent-tracking-events';

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
  name: 'at/knowledge/impact',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let queueKnowledgeImpact = async (job: KnowledgeImpactJob) => {
  await knowledgeImpactQueue.add(
    job,
    job.type == 'snapshot' ? { id: `knowledge-impact-${job.snapshotId}` } : undefined
  );
};

export let processKnowledgeImpact = async (job: KnowledgeImpactJob, now = new Date()) => {
  if (job.type == 'snapshot') {
    let impacts = await loadSnapshotImpacts({ snapshotId: job.snapshotId, now });
    await Events.fire('knowledge.catalog.changed:after', { impacts });

    return { impacts };
  }

  if (job.type == 'correction') {
    let impacts = await loadCorrectionImpacts({
      offeringId: job.offeringId,
      from: new Date(job.from),
      to: job.to ? new Date(job.to) : null
    });
    await Events.fire('knowledge.catalog.changed:after', { impacts });

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

  await Events.fire('knowledge.price_override.changed:after', {
    organizationId: organization.id,
    projectId: project?.id ?? null,
    impacts: [impact]
  });

  return { impacts: [impact] };
};

export let knowledgeImpactProcessor = knowledgeImpactQueue.process(async data => {
  await processKnowledgeImpact(data);
});
