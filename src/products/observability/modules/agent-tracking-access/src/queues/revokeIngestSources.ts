import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import {
  getAgentTracking,
  ignoreNotFound,
  isAgentTrackingEnabled
} from '@metorial/module-agent-tracking-sync';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';

let pageSize = 500;

export let revokeIngestSourcesCron = createCron(
  { name: 'agent-tracking/ingest-source/revoke/cron', cron: '0 * * * *' },
  async () => {
    if (!isAgentTrackingEnabled()) return;

    await revokeIngestSourcesManyQueue.add({}, { id: 'scan' });
  }
);

export let revokeIngestSourcesManyQueue = createQueue<{ cursor?: string }>({
  name: 'agent-tracking/ingest-source/revoke/many',
  workerOpts: { concurrency: 1 }
});

export let revokeIngestSourcesManyQueueProcessor = revokeIngestSourcesManyQueue.process(
  async data => {
    let ingestSources = await db.agentTrackingIngestSource.findMany({
      where: {
        status: 'revoked',
        serviceRevokedAt: null,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true }
    });
    if (!ingestSources.length) return;

    await revokeIngestSourceQueue.addManyWithOps(
      ingestSources.map(ingestSource => ({
        data: { ingestSourceId: ingestSource.id },
        opts: { id: ingestSource.id }
      }))
    );

    if (ingestSources.length == pageSize) {
      await revokeIngestSourcesManyQueue.add(
        { cursor: ingestSources[ingestSources.length - 1]!.id },
        hourlyPacedDelay()
      );
    }
  }
);

export let revokeIngestSourceQueue = createQueue<{ ingestSourceId: string }>({
  name: 'agent-tracking/ingest-source/revoke',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let revokeIngestSourceQueueProcessor = revokeIngestSourceQueue.process(async data => {
  let agentTracking = getAgentTracking();
  if (!agentTracking) return;

  let ingestSource = await db.agentTrackingIngestSource.findUnique({
    where: { id: data.ingestSourceId },
    include: { instance: { include: { organization: true } } }
  });
  if (!ingestSource || ingestSource.status != 'revoked' || ingestSource.serviceRevokedAt) {
    return;
  }

  await ignoreNotFound(
    agentTracking.ingestSource.revoke({
      organizationId: ingestSource.instance.organization.id,
      ingestSourceId: ingestSource.serviceIngestSourceId
    })
  );

  await db.agentTrackingIngestSource.update({
    where: { oid: ingestSource.oid },
    data: { serviceRevokedAt: new Date() }
  });
});

export let revokeIngestSourcesQueueProcessor = combineQueueProcessors([
  revokeIngestSourcesCron,
  revokeIngestSourcesManyQueueProcessor,
  revokeIngestSourceQueueProcessor
]);
