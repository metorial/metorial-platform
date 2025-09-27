import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { combineQueueProcessors, createQueue } from '@metorial/queue';

let expireCron = createCron(
  {
    name: 'macc/apiKey/expire',
    cron: '* * * * *'
  },
  async () => {
    let keysToExpires = await db.apiKey.findMany({
      where: {
        expiresAt: {
          lte: new Date()
        },
        status: 'active'
      }
    });
    if (keysToExpires.length === 0) return;

    await expireSingleQueue.addMany(
      keysToExpires.map(key => ({
        apiKeyId: key.id
      }))
    );
  }
);

let expireSingleQueue = createQueue<{ apiKeyId: string }>({
  name: 'macc/apiKey/expireSingle',
  workerOpts: {
    concurrency: 5
  }
});

let expireSingleQueueProcessor = expireSingleQueue.process(async data => {
  let apiKey = await db.apiKey.findUnique({
    where: {
      id: data.apiKeyId,
      status: 'active'
    },
    include: {
      machineAccess: true
    }
  });
  if (!apiKey) throw new Error('retry ... not found');

  await Fabric.fire('machine_access.api_key.expired:before', {
    apiKey,
    machineAccess: apiKey.machineAccess
  });

  let updatedApiKey = await db.apiKey.update({
    where: {
      id: data.apiKeyId
    },
    data: {
      status: 'expired'
    }
  });
  await Fabric.fire('machine_access.api_key.expired:after', {
    apiKey: updatedApiKey,
    machineAccess: apiKey.machineAccess
  });
});

export let expiresApiKeysProcessors = combineQueueProcessors([
  expireCron,
  expireSingleQueueProcessor
]);
