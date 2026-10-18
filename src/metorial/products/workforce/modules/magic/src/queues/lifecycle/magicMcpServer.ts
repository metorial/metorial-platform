import { db } from '@metorial/db';
import { enqueueConsumerTargetAccessCleanup } from '@metorial/module-consumer-access';
import { magicMcpServerBackingService } from '@metorial-subspace/module-integration';
import { createQueue } from '@metorial/queue';
import {
  type ConsumerOwner,
  ensureMagicMcpServerBacking,
  type MagicMcpBackingProviderInput
} from '../../lib/backing';
import { indexMagicMcpServerSearchQueue } from '../search/magicMcpServer';

let queueMagicMcpServerIndex = async (magicMcpServerId: string) => {
  await indexMagicMcpServerSearchQueue.add({ magicMcpServerId });
};

let cleanupMagicMcpServerConsumerRecords = async (d: { magicMcpServerId: string }) => {
  let magicMcpServer = await db.magicMcpServer.findUnique({
    where: { id: d.magicMcpServerId },
    include: {
      instance: {
        include: {
          organization: true
        }
      }
    }
  });
  if (!magicMcpServer) return;

  await db.consumerIntegration.deleteMany({
    where: {
      magicMcpServerOid: magicMcpServer.oid
    }
  });

  await enqueueConsumerTargetAccessCleanup({
    organizationId: magicMcpServer.instance.organization.id,
    magicMcpServerId: magicMcpServer.id
  });
};

type MagicMcpServerLifecycleQueueInput = {
  magicMcpServerId: string;
  providers?: MagicMcpBackingProviderInput[];
  owner?: ConsumerOwner;
  isReconciliation?: boolean;
};

// Backings are applied inline by the server service. This only finishes jobs enqueued by the
// previous queue-driven flow, which left the core row unbacked or marked reconciling.
let ensurePendingMagicMcpServerBacking = async (data: MagicMcpServerLifecycleQueueInput) => {
  let magicMcpServer = await db.magicMcpServer.findUnique({
    where: { id: data.magicMcpServerId },
    include: { instance: true }
  });
  if (!magicMcpServer || magicMcpServer.status !== 'active') return;
  if (magicMcpServer.hasSubspaceBacking && !magicMcpServer.isSubspaceBackingReconciling)
    return;

  await ensureMagicMcpServerBacking({
    instance: magicMcpServer.instance,
    server: magicMcpServer,
    providers: data.providers,
    owner: data.owner,
    isReconciliation: data.isReconciliation
  });
};

export let magicMcpServerCreatedQueue = createQueue<MagicMcpServerLifecycleQueueInput>({
  name: 'mgc/lc/server/created',
  workerOpts: { concurrency: 10 }
});

export let magicMcpServerCreatedQueueProcessor = magicMcpServerCreatedQueue.process(
  async data => {
    await ensurePendingMagicMcpServerBacking(data);
    await queueMagicMcpServerIndex(data.magicMcpServerId);
  }
);

export let magicMcpServerUpdatedQueue = createQueue<MagicMcpServerLifecycleQueueInput>({
  name: 'mgc/lc/server/updated',
  workerOpts: { concurrency: 10 }
});

export let magicMcpServerUpdatedQueueProcessor = magicMcpServerUpdatedQueue.process(
  async data => {
    await ensurePendingMagicMcpServerBacking(data);
    await queueMagicMcpServerIndex(data.magicMcpServerId);
  }
);

export let magicMcpServerDeletedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/deleted',
  workerOpts: { concurrency: 10 }
});

export let magicMcpServerDeletedQueueProcessor = magicMcpServerDeletedQueue.process(
  async data => {
    let magicMcpServer = await db.magicMcpServer.findUnique({
      where: { id: data.magicMcpServerId },
      include: { instance: true }
    });
    if (!magicMcpServer) return;

    await queueMagicMcpServerIndex(data.magicMcpServerId);
    await cleanupMagicMcpServerConsumerRecords({
      magicMcpServerId: data.magicMcpServerId
    });

    if (magicMcpServer.hasSubspaceBacking) {
      await magicMcpServerBackingService.archiveMagicMcpServerBacking({
        instance: magicMcpServer.instance,
        magicMcpServerBackingId: magicMcpServer.id
      });
    }
  }
);
