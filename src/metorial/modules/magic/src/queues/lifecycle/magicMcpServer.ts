import { db } from '@metorial/db';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
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

type MagicMcpServerLifecycleQueueInput = {
  magicMcpServerId: string;
  providers?: {
    providerDeploymentId: string;
    providerConfigId?: string | null;
    providerAuthConfigId?: string | null;
    toolFilters?: any;
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

    if (magicMcpServer.hasSubspaceBacking) {
      await subspaceMagicMcpBackingService.archiveServer({
        instance: magicMcpServer.instance,
        magicMcpServerBackingId: magicMcpServer.id
      });
    }
  }
);
