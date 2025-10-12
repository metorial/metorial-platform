import { db } from '@metorial/db';
import { customServerVersionService } from '@metorial/module-custom-server';
import { organizationActorService } from '@metorial/module-organization';
import { createQueue, QueueRetryError } from '@metorial/queue';

export let createHandleRepoPushQueue = createQueue<{ pushId: string }>({
  name: 'scm/rep/hndl-push'
});

export let createHandleRepoPushQueueProcessor = createHandleRepoPushQueue.process(
  async data => {
    let push = await db.scmRepoPush.findUnique({
      where: { id: data.pushId },
      include: { repo: true }
    });
    if (!push) throw new QueueRetryError();

    let customServers = await db.customServer.findMany({
      where: {
        repositoryOid: push.repo.oid
      }
    });

    await createHandleRepoPushForCustomServerQueue.addMany(
      customServers.map(cs => ({
        pushId: push.id,
        customServerId: cs.id
      }))
    );
  }
);

export let createHandleRepoPushForCustomServerQueue = createQueue<{
  pushId: string;
  customServerId: string;
}>({
  name: 'scm/rep/hndl-push/csrv'
});

export let createHandleRepoPushForCustomServerQueueProcessor =
  createHandleRepoPushForCustomServerQueue.process(async data => {
    let push = await db.scmRepoPush.findUnique({
      where: { id: data.pushId },
      include: { repo: true }
    });
    let customServers = await db.customServer.findFirst({
      where: { id: data.customServerId },
      include: {
        instance: {
          include: {
            organization: true
          }
        }
      }
    });
    if (!push || !customServers) throw new QueueRetryError();

    await customServerVersionService.createVersion({
      server: customServers,
      instance: customServers.instance,
      organization: customServers.instance.organization,
      performedBy: await organizationActorService.getSystemActor({
        organization: customServers.instance.organization
      }),
      push,
      serverInstance: {
        type: 'managed',
        implementation: {}
      }
    });
  });
