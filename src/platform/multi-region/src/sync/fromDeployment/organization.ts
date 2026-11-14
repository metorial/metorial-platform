import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createQueue, hourlyPacedDelay } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';

let SYNC_PAGE_SIZE = 500;

export let upsertOrganization = async (organizationId: string) => {
  let organization = await db.organization.findUnique({
    where: { id: organizationId }
  });
  if (!organization) return;

  let inner = {
    status: organization.status,
    type: organization.type,
    name: organization.name,
    slug: organization.slug,
    image: organization.image,
    createdAt: organization.createdAt,
    deletedAt: organization.deletedAt
  };

  try {
    await globalDB.organization.upsert({
      where: { id: organization.id },
      update: inner,
      create: { id: organization.id, ...inner, ownerOid: (await cell).oid }
    });
  } catch (err: any) {
    if (err.code !== 'P2002') throw err;

    let existing = await globalDB.organization.findUnique({
      where: { id: organization.id }
    });
    if (!existing) return;

    try {
      await globalDB.organization.update({
        where: { id: organization.id },
        data: inner
      });
    } catch (updateErr: any) {
      if (updateErr.code !== 'P2002') throw updateErr;

      await globalDB.organization.update({
        where: { id: organization.id },
        data: { ...inner, slug: existing.slug }
      });
    }
  }
};

export let syncOrgsCron = createCron(
  {
    name: 'global/sync/from-deployment/org',
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await syncOrgsManyQueue.add({});
  }
);

let syncOrgsManyQueue = createQueue<{ cursor?: string }>({
  name: 'global/sync/from-deployment/org-many',
  workerOpts: { concurrency: 1 }
});

export let syncOrgsManyQueueProcessor = syncOrgsManyQueue.process(async data => {
  let orgs = await db.organization.findMany({
    where: {
      id: { gt: data.cursor }
    },
    orderBy: { id: 'asc' },
    take: SYNC_PAGE_SIZE,
    select: { id: true }
  });
  if (orgs.length === 0) return;

  await syncOrgSingleQueue.addMany(orgs.map(org => ({ orgId: org.id })));

  if (orgs.length === SYNC_PAGE_SIZE) {
    await syncOrgsManyQueue.add({ cursor: orgs[orgs.length - 1].id }, hourlyPacedDelay());
  }
});

let syncOrgSingleQueue = createQueue<{ orgId: string }>({
  name: 'global/sync/from-deployment/org-single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncOrgSingleQueueProcessor = syncOrgSingleQueue.process(async data => {
  await upsertOrganization(data.orgId);
});

Fabric.listen('organization.updated:after', async event => {
  await syncOrgSingleQueue.add({ orgId: event.organization.id });
});

Fabric.listen('organization.created:after', async event => {
  await syncOrgSingleQueue.add({ orgId: event.organization.id });
});
