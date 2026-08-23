import { db } from '@metorial/db';
import { magicMcpEndpointBackingService } from '@metorial-subspace/module-integration';
import { createQueue } from '@metorial/queue';
import {
  ensureMagicMcpEndpointBacking,
  MAGIC_MCP_BACKING_READY_WORKER_ATTEMPTS,
  waitForMagicMcpEndpointBackingReady
} from '../../lib/backing';

export let magicMcpEndpointCreatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/created'
});

let ensureQueuedMagicMcpEndpointBacking = async (magicMcpEndpointId: string) => {
  let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
    where: { id: magicMcpEndpointId },
    include: {
      consumerProfile: true,
      consumerIntegrationEndpoints: {
        include: {
          consumer: true,
          consumerProfile: true
        }
      },
      servers: {
        include: {
          magicMcpServer: {
            include: {
              aliases: true,
              subspaceSession: true
            }
          }
        }
      },
      subspaceSession: true,
      skillPlugin: true,
      instance: true
    }
  });
  if (!magicMcpEndpoint || magicMcpEndpoint.status !== 'active') return;

  await ensureMagicMcpEndpointBacking({
    instance: magicMcpEndpoint.instance,
    endpoint: magicMcpEndpoint,
    deferReconcile: true
  });

  let latest = await waitForMagicMcpEndpointBackingReady({
    instance: magicMcpEndpoint.instance,
    endpoint: magicMcpEndpoint,
    attempts: MAGIC_MCP_BACKING_READY_WORKER_ATTEMPTS
  });

  if (latest?.isSubspaceBackingReconciling) {
    await db.magicMcpEndpoint.update({
      where: { oid: latest.oid },
      data: { isSubspaceBackingReconciling: false }
    });
  }
};

export let magicMcpEndpointCreatedQueueProcessor = magicMcpEndpointCreatedQueue.process(
  async data => {
    await ensureQueuedMagicMcpEndpointBacking(data.magicMcpEndpointId);
  }
);

export let magicMcpEndpointUpdatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/updated'
});

export let magicMcpEndpointUpdatedQueueProcessor = magicMcpEndpointUpdatedQueue.process(
  async data => {
    await ensureQueuedMagicMcpEndpointBacking(data.magicMcpEndpointId);
  }
);

export let magicMcpEndpointDeletedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/deleted'
});

export let magicMcpEndpointDeletedQueueProcessor = magicMcpEndpointDeletedQueue.process(
  async data => {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
      where: { id: data.magicMcpEndpointId },
      include: { instance: true }
    });
    if (!magicMcpEndpoint) return;

    if (magicMcpEndpoint.hasSubspaceBacking) {
      await magicMcpEndpointBackingService.archiveMagicMcpEndpointBacking({
        instance: magicMcpEndpoint.instance,
        magicMcpEndpointBackingId: magicMcpEndpoint.id
      });
    }
  }
);
