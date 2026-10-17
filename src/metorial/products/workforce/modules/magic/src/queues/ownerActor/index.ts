import { integrationInstanceService } from '@metorial-subspace/module-integration';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { getConsumerOwnerForServer } from '../../lib/backing';
import { resolveOwnerActorOid } from '../../lib/ownerActor';

let OWNER_RECONCILE_BATCH_SIZE = 500;

export let magicMcpServerOwnerReconcileCron = createCron(
  {
    name: 'magic/server/ownerActor/reconcile/cron',
    cron: '0 3 * * *'
  },
  async () => {
    await reconcileMagicMcpServerOwnersManyQueue.add(
      {},
      { id: 'magic-server-owner-actor-reconcile' }
    );
  }
);

export let reconcileMagicMcpServerOwnersManyQueue = createQueue<{ cursor?: string }>({
  name: 'magic/server/ownerActor/reconcile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileMagicMcpServerOwnersManyQueueProcessor =
  reconcileMagicMcpServerOwnersManyQueue.process(async data => {
    let servers = await db.magicMcpServer.findMany({
      where: {
        ownerActorOid: null,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!servers.length) return;

    await reconcileMagicMcpServerOwnerQueue.addManyWithOps(
      servers.map(server => ({
        data: { magicMcpServerId: server.id },
        opts: { id: server.id }
      }))
    );

    if (servers.length === OWNER_RECONCILE_BATCH_SIZE) {
      await reconcileMagicMcpServerOwnersManyQueue.add(
        { cursor: servers[servers.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileMagicMcpServerOwnerQueue = createQueue<{ magicMcpServerId: string }>({
  name: 'magic/server/ownerActor/reconcile/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileMagicMcpServerOwnerQueueProcessor =
  reconcileMagicMcpServerOwnerQueue.process(async data => {
    let server = await db.magicMcpServer.findUnique({
      where: { id: data.magicMcpServerId },
      include: { instance: true }
    });
    if (!server || server.ownerActorOid) return;

    let consumerOwner = await getConsumerOwnerForServer({
      instance: server.instance,
      server
    });
    let ownerActorOid = await resolveOwnerActorOid(consumerOwner);

    if (!ownerActorOid && server.subspaceIntegrationInstanceId) {
      let integrationInstance = await integrationInstanceService
        .getIntegrationInstanceById({
          instance: server.instance,
          integrationInstanceId: server.subspaceIntegrationInstanceId
        })
        .catch(() => null);

      ownerActorOid = await resolveOwnerActorOid({
        identityActorId: integrationInstance?.identityActor?.id
      });
    }

    if (!ownerActorOid) return;

    // await db.magicMcpServer.updateMany({
    //   where: { oid: server.oid, ownerActorOid: null },
    //   data: { ownerActorOid }
    // });
  });

export let magicOwnerActorQueueProcessor = combineQueueProcessors([
  magicMcpServerOwnerReconcileCron,
  reconcileMagicMcpServerOwnersManyQueueProcessor,
  reconcileMagicMcpServerOwnerQueueProcessor
]);
