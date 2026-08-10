import { createQueue } from '@lowerdeck/queue';
import { createMcpRegistryClient } from '@metorial-services/registry-client';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

export let setReadmeForShuttleServerQueue = createQueue<{
  shuttleServerId: string;
  registryUrl: string;
  registryServerId: string;
  attempt?: number;
  syncRecordId: string;
}>({
  name: 'sub/sht/set/readme',
  redisUrl: env.service.REDIS_URL
});

export let setReadmeForShuttleServerQueueProcessor = setReadmeForShuttleServerQueue.process(
  async data => {
    let server = await db.shuttleServer.findFirst({
      where: { id: data.shuttleServerId },
      include: {
        providerVariants: true
      }
    });
    let providerVariant = server?.providerVariants?.[0];
    if (!server || !providerVariant) {
      if (data.attempt && data.attempt >= 500) return;

      await setReadmeForShuttleServerQueue.add(
        {
          ...data,
          attempt: (data.attempt || 0) + 1
        },
        { delay: 5 * 60 * 1000 }
      );
      return;
    }

    let client = createMcpRegistryClient({
      endpoint: data.registryUrl
    });

    let regServer = await client.server.get({
      serverId: data.registryServerId
    });
    if (!regServer) return;

    await db.providerListing.updateMany({
      where: { providerOid: providerVariant.providerOid },
      data: { readme: regServer.readme }
    });

    await db.shuttleSyncServer.updateMany({
      where: { id: data.syncRecordId },
      data: { readmePending: false }
    });
  }
);
