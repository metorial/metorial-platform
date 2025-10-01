import { anonymizeIP } from '@metorial/anonymize-ip';
import { Context } from '@metorial/context';
import { db, ID } from '@metorial/db';
import { usageService } from '@metorial/module-usage';
import { createQueue } from '@metorial/queue';

export let serverSessionCreatedQueue = createQueue<{
  serverSessionId: string;
  context: Context;
}>({
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
            server: true,
            serverImplementation: true
          }
        }
      }
    });
    if (!serverSession) return;

    let instance = serverSession.instance;
    let serverDeployment = serverSession.serverDeployment;
    let serverImplementation = serverDeployment.serverImplementation;

    await db.sessionConnection.create({
      data: {
        id: await ID.generateId('sessionConnection'),

        serverSessionOid: serverSession.oid,
        sessionOid: serverSession.sessionOid,
        instanceOid: instance.oid,

        userAgent: data.context.ua,
        anonIp: anonymizeIP(data.context.ip, {
          maskChar: '0',
          keepGroups: {
            ipv4: 3,
            ipv6: 4
          }
        }),

        createdAt: serverSession.createdAt
      }
    });

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

    await usageService.ingestUsageRecord({
      owner: {
        id: instance.id,
        type: 'instance'
      },
      entity: {
        id: serverDeployment.server.id,
        type: 'server'
      },
      type: 'server_run.created'
    });
  }
);
