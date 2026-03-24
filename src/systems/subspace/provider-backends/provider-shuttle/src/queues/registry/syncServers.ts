import { createCron } from '@lowerdeck/cron';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { slugify } from '@lowerdeck/slugify';
import {
  createMcpRegistryClient,
  createRootRegistryClient
} from '@metorial-services/registry-client';
import { db } from '@metorial-subspace/db';
import { publisherInternalService } from '@metorial-subspace/module-provider-internal';
import { shuttle } from '../../client';
import { env } from '../../env';
import { setReadmeForShuttleServerQueue } from './setReadme';

let registryClient = env.service.REGISTRY_URL
  ? createRootRegistryClient({
      endpoint: env.service.REGISTRY_URL
    })
  : null;

let lock = createLock({
  name: 'sub/sht/sync/server/cnhnotif/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncServersCron = createCron(
  {
    name: 'sub/sht/sync/server/cron',
    redisUrl: env.service.REDIS_URL,
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    if (!registryClient) return;

    let registries = await registryClient.registry.list({});
    let serverRegistries = registries.filter(r => r.from.type === 'mcp');

    await syncServersReg.addMany(
      serverRegistries.map(r => ({
        registryUrl: r.from.url
      }))
    );
  }
);

let syncServersReg = createQueue<{
  registryUrl: string;
}>({
  name: 'sub/sht/sync/server/reg',
  redisUrl: env.service.REDIS_URL
});

export let syncServersRegProcessor = syncServersReg.process(async data => {
  await syncServersMany.add({
    registryUrl: data.registryUrl
  });
});

let syncServersMany = createQueue<{
  registryUrl: string;
}>({
  name: 'sub/sht/sync/server/many',
  redisUrl: env.service.REDIS_URL
});

export let syncServersManyProcessor = syncServersMany.process(data =>
  lock.usingLock(data.registryUrl, async () => {
    let client = createMcpRegistryClient({
      endpoint: data.registryUrl
    });

    let cursor = await db.shuttleSyncMcpServerRegistryCursor.findUnique({
      where: { registryUrl: data.registryUrl }
    });

    let servers = await client.server.list({
      after: cursor?.cursor,
      limit: 100
    });
    if (!servers.items.length) return;

    await syncServersSingle.addManyWithOps(
      servers.items.map(s => ({
        data: { id: s.id, registryUrl: data.registryUrl },
        opts: { id: s.id }
      }))
    );

    await db.shuttleSyncMcpServerRegistryCursor.upsert({
      where: { registryUrl: data.registryUrl },
      create: {
        registryUrl: data.registryUrl,
        cursor: servers.items[servers.items.length - 1]!.id as string
      },
      update: {
        cursor: servers.items[servers.items.length - 1]!.id as string
      }
    });

    await syncServersMany.add({
      registryUrl: data.registryUrl
    });
  })
);

let syncServersSingle = createQueue<{
  registryUrl: string;
  id: string;
}>({
  name: 'sub/sht/sync/server/sing',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 2,
      duration: 5 * 1000
    }
  }
});

export let syncServersSingleProcessor = syncServersSingle.process(async data => {
  let client = createMcpRegistryClient({
    endpoint: data.registryUrl
  });

  let server = await client.server.get({
    serverId: data.id
  });

  let latestVersion = server.versions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  if (!latestVersion) return;

  let publisher = await publisherInternalService.upsertPublisherForExternal({
    identifier: `reg::${data.registryUrl}::${server.publisher.identifier}`,
    name: server.publisher.name,
    imageUrl: server.publisher.imageUrl ?? undefined
  });

  let inner = {
    name: server.name,
    description: server.description ?? undefined,
    metadata: {
      publisherId: publisher.id,
      registryUrl: data.registryUrl,
      registryServerId: server.id,
      globalIdentifier: slugify(
        `${server.name}-${(await Hash.sha256(JSON.stringify(['shuttle', server.id, data.registryUrl]))).slice(0, 6)}`
      ),
      categories: server.categories.map(c => c.identifier),
      collections: server.collections.map(c => c.identifier)
    }
  };

  let syncRecord = await db.shuttleSyncServer.create({
    data: {
      record: inner,
      registryUrl: data.registryUrl,
      shuttleServerId: '',
      registryServerId: server.id,
      readmePending: !!server.readme
    }
  });

  if (latestVersion.from.type === 'remote') {
    let res = await shuttle.server.create({
      from: {
        type: 'remote',
        remoteUrl: latestVersion.from.remoteUrl,
        protocol: latestVersion.from.protocol
      },
      ...inner
    });

    await db.shuttleSyncServer.updateMany({
      where: { id: syncRecord.id },
      data: { shuttleServerId: res.server.id }
    });

    if (server.readme) {
      await setReadmeForShuttleServerQueue.add(
        {
          shuttleServerId: res.server.id,
          registryServerId: server.id,
          registryUrl: data.registryUrl,
          syncRecordId: syncRecord.id
        },
        { delay: 5 * 60 * 1000 }
      );
    }
  } else if (latestVersion.from.type === 'container') {
    let res = await shuttle.server.create({
      from: {
        type: 'container.from_image_ref',
        imageRef: latestVersion.from.imageRef
      },
      ...inner
    });

    await db.shuttleSyncServer.updateMany({
      where: { id: syncRecord.id },
      data: { shuttleServerId: res.server.id }
    });

    if (server.readme) {
      await setReadmeForShuttleServerQueue.add(
        {
          shuttleServerId: res.server.id,
          registryServerId: server.id,
          registryUrl: data.registryUrl,
          syncRecordId: syncRecord.id
        },
        { delay: 5 * 60 * 1000 }
      );
    }
  }
});
