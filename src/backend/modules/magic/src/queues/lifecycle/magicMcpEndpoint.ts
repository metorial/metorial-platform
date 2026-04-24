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
    let uniqueSubspaceTemplateIds = uniqueSubspaceTemplatesRaw
      .map(record => record.subspaceSessionTemplateId)
      .filter((value): value is string => !!value);

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

    for (let subspaceSessionId of uniqueSubspaceSessionIds) {
      await subspaceSessionService.delete({
        instance: magicMcpEndpoint.instance,
        sessionId: subspaceSessionId,
        _allowMagicMcpDelete: true
      });
    }
  }
);
