import { db } from '@metorial/db';
import { usageService } from '@metorial/module-usage';
import { createQueue } from '@metorial/queue';

export let serverSessionCreatedQueue = createQueue<{ serverSessionId: string }>({
  name: 'ses/ssn/cret'
});

export let serverSessionCreatedQueueProcessor = serverSessionCreatedQueue.process(
  async data => {
    let serverSession = await db.serverSession.findFirst({
      where: {
        id: data.serverSessionId
      },
      include: {
        instance: true,
        serverDeployment: {
          include: {
            serverImplementation: true
          }
        }
      }
    });
    if (!serverSession) return;

    let instance = serverSession.instance;
    let serverDeployment = serverSession.serverDeployment;
    let serverImplementation = serverDeployment.serverImplementation;

    await usageService.ingestUsageRecord({
      owner: {
        id: instance.id,
        type: 'instance'
      },
      entity: {
        id: serverImplementation.id,
        type: 'server_implementation'
      },
      type: 'server_run.created'
    });

    await usageService.ingestUsageRecord({
      owner: {
        id: instance.id,
        type: 'instance'
      },
      entity: {
        id: serverDeployment.id,
        type: 'server_deployment'
      },
      type: 'server_run.created'
    });
  }
);
