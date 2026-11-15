import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';
import { upsertOrganization } from './organization';

let SYNC_PAGE_SIZE = 500;

export let syncConsumerSurfacesCron = createCron(
  {
    name: 'global/sync/from-deployment/consumer-surface',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncConsumerSurfacesManyQueue.add({});
  }
);

let syncConsumerSurfacesManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/consumer-surface-many',
  workerOpts: { concurrency: 1 }
});

export let syncConsumerSurfacesManyQueueProcessor = syncConsumerSurfacesManyQueue.process(
  async data => {
    let surfaces = await db.consumerSurface.findMany({
      where: {
        id: { gt: data.cursor }
      },
      orderBy: { id: 'asc' },
      take: SYNC_PAGE_SIZE,
      select: { id: true }
    });
    if (surfaces.length === 0) return;

    await syncConsumerSurfaceSingleQueue.addMany(
      surfaces.map(s => ({ consumerSurfaceId: s.id }))
    );

    if (surfaces.length === SYNC_PAGE_SIZE) {
      await syncConsumerSurfacesManyQueue.add(
        { cursor: surfaces[surfaces.length - 1].id },
        hourlyPacedDelay()
      );
    }
  }
);

let syncConsumerSurfaceSingleQueue = createQueue<{ consumerSurfaceId: string }>({
  name: 'global/sync/from-deployment/consumer-surface-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncConsumerSurfaceSingleQueueProcessor = syncConsumerSurfaceSingleQueue.process(
  async data => {
    let surface = await db.consumerSurface.findUnique({
      where: { id: data.consumerSurfaceId },
      include: {
        organization: {
          select: {
            id: true
          }
        },
        instance: {
          select: {
            id: true
          }
        }
      }
    });
    if (!surface) return;

    await upsertOrganization(surface.organization.id);

    let inner = {
      status: surface.status,
      type: surface.type,
      name: surface.name,
      description: surface.description,
      organizationId: surface.organization.id,
      instanceId: surface.instance.id,
      archivedAt: surface.archivedAt,
      deletedAt: surface.deletedAt,
      createdAt: surface.createdAt,
      ownerOid: (await cell).oid
    };

    await globalDB.consumerSurface.upsert({
      where: { id: surface.id },
      update: inner,
      create: {
        id: surface.id,
        ...inner
      }
    });
  }
);
