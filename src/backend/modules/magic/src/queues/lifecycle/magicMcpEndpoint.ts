import { db } from '@metorial/db';
import {
  subspaceSessionService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
import { createQueue } from '@metorial/queue';

export let magicMcpEndpointCreatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/created'
});

export let magicMcpEndpointCreatedQueueProcessor = magicMcpEndpointCreatedQueue.process(
  async () => {}
);

export let magicMcpEndpointUpdatedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/updated'
});

export let magicMcpEndpointUpdatedQueueProcessor = magicMcpEndpointUpdatedQueue.process(
  async () => {}
);

export let magicMcpEndpointDeletedQueue = createQueue<{ magicMcpEndpointId: string }>({
  name: 'mgc/lc/endpoint/deleted'
});

export let magicMcpEndpointDeletedSubspaceSessionQueue = createQueue<{
  instanceId: string;
  subspaceSessionId: string;
}>({
  name: 'mgc/lc/endpoint/deleted/subspaceSession',
  workerOpts: {
    concurrency: 20
  }
});

export let magicMcpEndpointDeletedSubspaceSessionQueueProcessor =
  magicMcpEndpointDeletedSubspaceSessionQueue.process(async data => {
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

export let magicMcpEndpointDeletedQueueProcessor = magicMcpEndpointDeletedQueue.process(
  async data => {
    let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
      where: { id: data.magicMcpEndpointId },
      include: { instance: true }
    });
    if (!magicMcpEndpoint) return;

    let uniqueSubspaceTemplatesRaw = await db.magicMcpSession.findMany({
      where: { magicMcpEndpointOid: magicMcpEndpoint.oid },
      select: { subspaceSessionTemplateId: true },
      distinct: ['subspaceSessionTemplateId']
    });
    let uniqueSubspaceTemplateIds = Array.from(
      new Set(
        uniqueSubspaceTemplatesRaw
          .map(record => record.subspaceSessionTemplateId)
          .concat([
            magicMcpEndpoint.legacySubspaceSessionTemplateId,
            magicMcpEndpoint.newSubspaceSessionTemplateId
          ])
          .filter((value): value is string => !!value)
      )
    );

    let uniqueSubspaceSessionsRaw = await db.magicMcpSession.findMany({
      where: { magicMcpEndpointOid: magicMcpEndpoint.oid },
      select: { subspaceSessionId: true },
      distinct: ['subspaceSessionId']
    });
    let uniqueSubspaceSessionIds = uniqueSubspaceSessionsRaw
      .map(record => record.subspaceSessionId)
      .filter((value): value is string => !!value);

    await db.magicMcpSession.deleteMany({
      where: { magicMcpEndpointOid: magicMcpEndpoint.oid }
    });

    for (let subspaceSessionTemplateId of uniqueSubspaceTemplateIds) {
      await subspaceSessionTemplateService.delete({
        instance: magicMcpEndpoint.instance,
        sessionTemplateId: subspaceSessionTemplateId,
        _allowMagicMcpDelete: true
      });
    }

    if (uniqueSubspaceSessionIds.length) {
      await magicMcpEndpointDeletedSubspaceSessionQueue.addMany(
        uniqueSubspaceSessionIds.map(subspaceSessionId => ({
          instanceId: magicMcpEndpoint.instance.id,
          subspaceSessionId
        }))
      );
    }
  }
);
