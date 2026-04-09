import { db } from '@metorial/db';
import {
  subspaceSessionService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
import { createQueue } from '@metorial/queue';
import { indexMagicMcpServerSearchQueue } from '../search/magicMcpServer';

let queueMagicMcpServerIndex = async (magicMcpServerId: string) => {
  await indexMagicMcpServerSearchQueue.add({ magicMcpServerId });
};

export let magicMcpServerCreatedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/created'
});

export let magicMcpServerCreatedQueueProcessor = magicMcpServerCreatedQueue.process(
  async data => {
    await queueMagicMcpServerIndex(data.magicMcpServerId);
  }
);

export let magicMcpServerUpdatedQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'mgc/lc/server/updated'
});

export let magicMcpServerUpdatedQueueProcessor = magicMcpServerUpdatedQueue.process(
  async data => {
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

    let uniqueSubspaceTemplatesRaw = await db.magicMcpSubspaceSessionConnection.findMany({
      where: { magicMcpServerOid: magicMcpServer.oid },
      select: { subspaceSessionTemplateId: true },
      distinct: ['subspaceSessionTemplateId']
    });
    let uniqueSubspaceTemplateIds = uniqueSubspaceTemplatesRaw.map(
      record => record.subspaceSessionTemplateId
    );

    let uniqueSubspaceSessionsRaw = await db.magicMcpSubspaceSessionConnection.findMany({
      where: { magicMcpServerOid: magicMcpServer.oid },
      select: { subspaceSessionId: true },
      distinct: ['subspaceSessionId']
    });
    let uniqueSubspaceSessionIds = uniqueSubspaceSessionsRaw.map(
      record => record.subspaceSessionId
    );

    for (let subspaceSessionTemplateId of uniqueSubspaceTemplateIds) {
      await subspaceSessionTemplateService.delete({
        instance: magicMcpServer.instance,
        sessionTemplateId: subspaceSessionTemplateId,
        _allowMagicMcpDelete: true
      });
    }

    for (let subspaceSessionId of uniqueSubspaceSessionIds) {
      await subspaceSessionService.delete({
        instance: magicMcpServer.instance,
        sessionId: subspaceSessionId,
        _allowMagicMcpDelete: true
      });
    }
  }
);

export let enqueueMagicMcpServerCreated = async (magicMcpServerId: string) => {
  await magicMcpServerCreatedQueue.add({ magicMcpServerId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP server create indexing', error);
  });
};

export let enqueueMagicMcpServerUpdated = async (magicMcpServerId: string) => {
  await magicMcpServerUpdatedQueue.add({ magicMcpServerId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP server update indexing', error);
  });
};

export let enqueueMagicMcpServerDeleted = async (magicMcpServerId: string) => {
  await magicMcpServerDeletedQueue.add({ magicMcpServerId }).catch(error => {
    console.error('[module-magic] Failed to enqueue magic MCP server delete indexing', error);
  });
};
