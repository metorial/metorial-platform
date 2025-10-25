import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { organizationActorService } from '@metorial/module-organization';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';

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
  if (!apiKey) throw new QueueRetryError();

  let organization = apiKey.machineAccess.organizationOid
    ? await db.organization.findUniqueOrThrow({
        where: { oid: apiKey.machineAccess.organizationOid }
      })
    : null;
  let systemActor = organization
    ? await organizationActorService.getSystemActor({ organization })
    : null;

  if (organization && systemActor) {
    await Fabric.fire('machine_access.api_key.expired:before', {
      apiKey,
      organization,
      performedBy: systemActor,
      machineAccess: apiKey.machineAccess
    });
  }

  let updatedApiKey = await db.apiKey.update({
    where: {
      id: data.apiKeyId
    },
    data: {
      status: 'expired'
    }
  });

  if (organization && systemActor) {
    await Fabric.fire('machine_access.api_key.expired:after', {
      organization,
      apiKey: updatedApiKey,
      performedBy: systemActor,
      machineAccess: apiKey.machineAccess
    });
  }
});

export let expiresApiKeysProcessors = combineQueueProcessors([
  expireCron,
  expireSingleQueueProcessor
]);
