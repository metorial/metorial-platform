import { db } from '@metorial/db';
import { enqueueConsumerTargetAccessCleanup } from '@metorial/module-consumer';
import { magicMcpServerBackingService } from '@metorial-subspace/module-integration';
import { createQueue } from '@metorial/queue';
import {
  type ConsumerOwner,
  ensureMagicMcpServerBacking,
  MAGIC_MCP_BACKING_READY_WORKER_ATTEMPTS,
  waitForMagicMcpServerBackingReady
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
  providers?: {
    providerDeploymentId: string;
    providerConfigId?: string | null;
    providerAuthConfigId?: string | null;
    toolFilters?: PrismaJson.ToolFilter | null;
  }[];
  owner?: ConsumerOwner;
  isReconciliation?: boolean;
};

let ensureQueuedMagicMcpServerBacking = async (data: MagicMcpServerLifecycleQueueInput) => {
  let magicMcpServer = await db.magicMcpServer.findUnique({
    where: { id: data.magicMcpServerId },
    include: { instance: true }
  });
  if (!magicMcpServer || magicMcpServer.status !== 'active') return;

  await ensureMagicMcpServerBacking({
    instance: magicMcpServer.instance,
    server: magicMcpServer,
    providers: data.providers,
    owner: data.owner,
    isReconciliation: data.isReconciliation,
    deferReconcile: true
  });

  let latest = await waitForMagicMcpServerBackingReady({
    instance: magicMcpServer.instance,
    server: magicMcpServer,
    attempts: MAGIC_MCP_BACKING_READY_WORKER_ATTEMPTS
  });

  if (latest?.isSubspaceBackingReconciling) {
    await db.magicMcpServer.update({
      where: { oid: latest.oid },
      data: { isSubspaceBackingReconciling: false }
    });
  }
};

export let magicMcpServerCreatedQueue = createQueue<MagicMcpServerLifecycleQueueInput>({
  name: 'mgc/lc/server/created'
});

export let magicMcpServerCreatedQueueProcessor = magicMcpServerCreatedQueue.process(
  async data => {
    await ensureQueuedMagicMcpServerBacking(data);
    await queueMagicMcpServerIndex(data.magicMcpServerId);
  }
);

export let magicMcpServerUpdatedQueue = createQueue<MagicMcpServerLifecycleQueueInput>({
  name: 'mgc/lc/server/updated'
});

export let magicMcpServerUpdatedQueueProcessor = magicMcpServerUpdatedQueue.process(
  async data => {
    await ensureQueuedMagicMcpServerBacking(data);
    await queueMagicMcpServerIndex(data.magicMcpServerId);
  }
);

export let magicMcpServerDeletedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/deleted'
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
