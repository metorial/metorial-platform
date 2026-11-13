import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { getGroundstation } from '../lib/client';
import { revokeAgentTelemetryIngestToken } from '../lib/ingestToken';

export let revokeDeviceIngestTokensQueue = createQueue<{ consumerDeviceId: string }>({
  name: 'agent-telemetry/token/revoke-device',
  workerOpts: { concurrency: 5 }
});

export let revokeDeviceIngestTokensQueueProcessor = revokeDeviceIngestTokensQueue.process(
  async data => {
    let consumerDevice = await db.consumerDevice.findUnique({
      where: { id: data.consumerDeviceId }
    });
    if (!consumerDevice || consumerDevice.status == 'active') return;

    let ingestTokens = await db.agentTelemetryIngestToken.findMany({
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
  name: 'agent-telemetry/token/revoke',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let revokeIngestTokenQueueProcessor = revokeIngestTokenQueue.process(async data => {
  let groundstation = getGroundstation();
  if (!groundstation) return;

  let ingestToken = await db.agentTelemetryIngestToken.findUnique({
    where: { id: data.ingestTokenId }
  });
  if (!ingestToken) return;

  await revokeAgentTelemetryIngestToken({ groundstation, ingestToken });
});

export let revokeTokensQueueProcessor = combineQueueProcessors([
  revokeDeviceIngestTokensQueueProcessor,
  revokeIngestTokenQueueProcessor
]);
