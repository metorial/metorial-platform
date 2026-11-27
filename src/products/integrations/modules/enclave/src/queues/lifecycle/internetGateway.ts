import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, Prisma } from '@metorial-subspace/db';
import { env } from '../../env';

export let internetGatewayCreatedQueue = createQueue<{ internetGatewayId: string }>({
  name: 'sub/enc/lc/network/created',
  workerOpts: { concurrency: 10 },
  redisUrl: env.service.REDIS_URL
});

export let internetGatewayCreatedQueueProcessor = internetGatewayCreatedQueue.process(
  async data => {
    let internetGateway = await db.integrationInternetGateway.findFirst({
      where: { id: data.internetGatewayId },
      select: { oid: true }
    });
    if (!internetGateway) throw new QueueRetryError();

    await db.integrationEnclave.updateMany({
      where: { internetGatewayOid: internetGateway.oid },
      data: {
        compiledNetworkRules: Prisma.JsonNull,
        needsEnclaveReconciliation: true
      }
    });
  }
);
