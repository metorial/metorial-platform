import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, Prisma } from '@metorial-subspace/db';
import { env } from '../../env';

export let networkCreatedQueue = createQueue<{ networkId: string }>({
  name: 'sub/enc/lc/network/created',
  redisUrl: env.service.REDIS_URL
});

export let networkCreatedQueueProcessor = networkCreatedQueue.process(async data => {
  let network = await db.network.findFirst({
    where: { id: data.networkId },
    select: { oid: true }
  });
  if (!network) throw new QueueRetryError();

  await db.enclave.updateMany({
    where: { networkOid: network.oid },
    data: {
      compiledNetworkRules: Prisma.JsonNull,
      needsEnclaveReconciliation: true
    }
  });
});
