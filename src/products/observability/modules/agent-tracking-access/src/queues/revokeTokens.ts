import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { getAgentTracking } from '@metorial/module-agent-tracking-sync';
import { revokeAgentTrackingIngestToken } from '../lib/ingestToken';

export let revokeDeviceIngestTokensQueue = createQueue<{ consumerDeviceId: string }>({
  name: 'agent-tracking/token/revoke-device',
  workerOpts: { concurrency: 5 }
});

export let revokeDeviceIngestTokensQueueProcessor = revokeDeviceIngestTokensQueue.process(
  async data => {
    let consumerDevice = await db.consumerDevice.findUnique({
      where: { id: data.consumerDeviceId }
    });
    if (!consumerDevice || consumerDevice.status == 'active') return;

    let ingestTokens = await db.agentTrackingIngestToken.findMany({
      where: { consumerDeviceOid: consumerDevice.oid, status: 'active' },
      select: { id: true }
    });

    await revokeIngestTokenQueue.addManyWithOps(
      ingestTokens.map(ingestToken => ({
        data: { ingestTokenId: ingestToken.id },
        opts: { id: ingestToken.id }
      }))
    );
  }
);

export let revokeIngestTokenQueue = createQueue<{ ingestTokenId: string }>({
  name: 'agent-tracking/token/revoke',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let revokeIngestTokenQueueProcessor = revokeIngestTokenQueue.process(async data => {
  let agentTracking = getAgentTracking();
  if (!agentTracking) return;

  let ingestToken = await db.agentTrackingIngestToken.findUnique({
    where: { id: data.ingestTokenId }
  });
  if (!ingestToken) return;

  await revokeAgentTrackingIngestToken({ agentTracking, ingestToken });
});

export let revokeTokensQueueProcessor = combineQueueProcessors([
  revokeDeviceIngestTokensQueueProcessor,
  revokeIngestTokenQueueProcessor
]);
