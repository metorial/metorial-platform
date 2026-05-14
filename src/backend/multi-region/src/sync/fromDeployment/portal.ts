import { createCron } from '@metorial/cron';
import { addAfterTransactionHook, db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';
import { upsertOrganization } from './organization';

export let syncPortalsCron = createCron(
  {
    name: 'global/sync/from-deployment/portal',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncPortalsManyQueue.add({});
  }
);

let syncPortalsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/portal-many'
});

export let syncPortalsManyQueueProcessor = syncPortalsManyQueue.process(async data => {
  let portals = await db.portal.findMany({
    where: {
      id: { gt: data.cursor }
    },
    orderBy: { id: 'asc' },
    take: 100,
    select: { id: true }
  });
  if (portals.length === 0) return;

  await syncPortalSingleQueue.addMany(portals.map(portal => ({ portalId: portal.id })));

  await syncPortalsManyQueue.add({ cursor: portals[portals.length - 1].id });
});

let syncPortalSingleQueue = createQueue<{ portalId: string }>({
  name: 'global/sync/from-deployment/portal-single'
});

export let syncPortalSingleQueueProcessor = syncPortalSingleQueue.process(async data => {
  let portal = await db.portal.findUnique({
    where: { id: data.portalId },
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
  if (!portal) return;

  await upsertOrganization(portal.organization.id);

  let inner = {
    status: portal.status,
    name: portal.name,
    description: portal.description,
    slug: portal.slug,
    organizationId: portal.organization.id,
    instanceId: portal.instance.id,
    archivedAt: portal.archivedAt,
    deletedAt: portal.deletedAt,
    createdAt: portal.createdAt,
    ownerOid: (await cell).oid
  };

  await globalDB.portal.upsert({
    where: { id: portal.id },
    update: inner,
    create: {
      id: portal.id,
      ...inner
    }
  });
});

Fabric.listen('portal.created:after', async event => {
  await addAfterTransactionHook(() =>
    syncPortalSingleQueue.add({ portalId: event.portal.id })
  );
});

Fabric.listen('portal.updated:after', async event => {
  await addAfterTransactionHook(() =>
    syncPortalSingleQueue.add({ portalId: event.portal.id })
  );
});

Fabric.listen('portal.archived:after', async event => {
  await addAfterTransactionHook(() =>
    syncPortalSingleQueue.add({ portalId: event.portal.id })
  );
});
