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

export let magicMcpServerDeletedSubspaceSessionQueue = createQueue<{
  instanceId: string;
  subspaceSessionId: string;
}>({
  name: 'mgc/lc/server/deleted/subspaceSession',
  workerOpts: {
    concurrency: 20
  }
});

export let magicMcpServerDeletedSubspaceSessionQueueProcessor =
  magicMcpServerDeletedSubspaceSessionQueue.process(async data => {
    let instance = await db.instance.findUnique({
      where: { id: data.instanceId }
    });
    if (!instance) return;

    await subspaceSessionService.delete({
      instance,
      sessionId: data.subspaceSessionId,
      _allowMagicMcpDelete: true
    });
  });

export let magicMcpServerDeletedQueueProcessor = magicMcpServerDeletedQueue.process(
  async data => {
    let magicMcpServer = await db.magicMcpServer.findUnique({
      where: { id: data.magicMcpServerId },
      include: { instance: true }
    });
    if (!magicMcpServer) return;

    await queueMagicMcpServerIndex(data.magicMcpServerId);

    let uniqueSubspaceTemplatesRaw = await db.magicMcpSession.findMany({
      where: { magicMcpServerOid: magicMcpServer.oid },
      select: { subspaceSessionTemplateId: true },
      distinct: ['subspaceSessionTemplateId']
    });
    let uniqueSubspaceTemplateIds = Array.from(
      new Set([
        ...uniqueSubspaceTemplatesRaw.map(record => record.subspaceSessionTemplateId),
        magicMcpServer.legacySubspaceSessionTemplateId,
        magicMcpServer.newSubspaceSessionTemplateId
      ])
    ).filter((value): value is string => !!value);

    let uniqueSubspaceSessionsRaw = await db.magicMcpSession.findMany({
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

    if (uniqueSubspaceSessionIds.length) {
      await magicMcpServerDeletedSubspaceSessionQueue.addMany(
        uniqueSubspaceSessionIds.map(subspaceSessionId => ({
          instanceId: magicMcpServer.instance.id,
          subspaceSessionId
        }))
      );
    }
  }
);
