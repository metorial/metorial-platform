import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import { entityService } from '../services/entity';
import type { InstanceSettings } from '@mtsrc/agent-tracking-spec';

let pageSize = 500;
let defaultIdleDays = 7;
let dayMs = 24 * 60 * 60 * 1000;

export let ephemeralDeviceIdleDays = (instances: { settings: InstanceSettings }[]) =>
  instances.length
    ? Math.min(
        ...instances.map(
          instance => instance.settings.ephemeralDeviceIdleDays ?? defaultIdleDays
        )
      )
    : defaultIdleDays;

export let archiveIdleEphemeralDevices = async (d: {
  organization: Organization;
  now?: Date;
}) => {
  let instances = await db.instance.findMany({
    where: { organizationOid: d.organization.oid, archivedAt: null },
    select: { settings: true }
  });

  let cutoff = new Date(
    (d.now ?? new Date()).getTime() - ephemeralDeviceIdleDays(instances) * dayMs
  );
  let archived = 0;

  for (let cursor: bigint | undefined; ;) {
    let devices = await db.entity.findMany({
      where: {
        organizationOid: d.organization.oid,
        kind: 'device',
        status: 'discovered',
        attributes: { path: ['ephemeral'], equals: true },
        OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null, createdAt: { lt: cutoff } }],
        oid: cursor ? { gt: cursor } : undefined
      },
      orderBy: { oid: 'asc' },
      take: pageSize
    });

    for (let device of devices) {
      await entityService.archiveEntity({ organization: d.organization, entity: device });
      archived++;
    }

    if (devices.length < pageSize) break;
    cursor = devices[devices.length - 1]!.oid;
  }

  return { archived };
};

export let archiveEphemeralDevicesCron = createCron(
  {
    name: 'at/devices/archive-ephemeral/cron',
    cron: '30 4 * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 60_000
  },
  async () => {
    await archiveEphemeralDevicesManyQueue.add({});
  }
);

export let archiveEphemeralDevicesManyQueue = createQueue<{ cursor?: string }>({
  name: 'at/devices/archive-ephemeral/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let archiveEphemeralDevicesManyProcessor = archiveEphemeralDevicesManyQueue.process(
  async data => {
    let organizations = await db.organization.findMany({
      where: { archivedAt: null, id: data.cursor ? { gt: data.cursor } : undefined },
      orderBy: { id: 'asc' },
      take: pageSize,
      select: { id: true }
    });

    if (!organizations.length) return;

    await archiveEphemeralDevicesSingleQueue.addManyWithOps(
      organizations.map(organization => ({
        data: { organizationId: organization.id },
        opts: { id: organization.id }
      }))
    );

    if (organizations.length == pageSize) {
      await archiveEphemeralDevicesManyQueue.add(
        { cursor: organizations[organizations.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let archiveEphemeralDevicesSingleQueue = createQueue<{ organizationId: string }>({
  name: 'at/devices/archive-ephemeral/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let archiveEphemeralDevicesSingleProcessor = archiveEphemeralDevicesSingleQueue.process(
  async data => {
    let organization = await db.organization.findUnique({
      where: { id: data.organizationId }
    });
    if (!organization || organization.archivedAt) return;

    await archiveIdleEphemeralDevices({ organization });
  }
);

export let archiveEphemeralDevicesProcessor = combineQueueProcessors([
  archiveEphemeralDevicesCron,
  archiveEphemeralDevicesManyProcessor,
  archiveEphemeralDevicesSingleProcessor
]);
