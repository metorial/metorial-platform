import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import {
  getGroundstation,
  ignoreNotFound,
  isAgentTelemetryEnabled
} from '../internal/groundstation';
import { archivableStatuses, syncedEntitySources } from '../lib/mapping';
import { syncScopeQueue } from './syncScope';

let pageSize = 500;
let entityPageSize = 100;

export let reconcileCron = createCron(
  { name: 'agent-telemetry/reconcile/cron', cron: '0 3 * * *', startupJitterMs: 60_000 },
  async () => {
    if (!isAgentTelemetryEnabled()) return;

    await reconcileManyQueue.add({});
  }
);

export let reconcileManyQueue = createQueue<{ cursor?: string }>({
  name: 'agent-telemetry/reconcile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileManyQueueProcessor = reconcileManyQueue.process(async data => {
  let organizations = await db.organization.findMany({
    where: { id: data.cursor ? { gt: data.cursor } : undefined },
    orderBy: { id: 'asc' },
    take: pageSize,
    select: { id: true }
  });
  if (!organizations.length) return;

  await reconcileSingleQueue.addManyWithOps(
    organizations.map(organization => ({
      data: { organizationId: organization.id },
      opts: { id: organization.id }
    }))
  );

  if (organizations.length == pageSize) {
    await reconcileManyQueue.add(
      { cursor: organizations[organizations.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

export let reconcileSingleQueue = createQueue<{ organizationId: string }>({
  name: 'agent-telemetry/reconcile/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileSingleQueueProcessor = reconcileSingleQueue.process(async data => {
  let organization = await db.organization.findUnique({ where: { id: data.organizationId } });
  if (!organization) return;

  await syncScopeQueue.add({ type: 'organization', id: organization.id });
  if (organization.status != 'active') return;

  await reconcileScopesQueue.addMany([
    { organizationId: organization.id, type: 'project' },
    { organizationId: organization.id, type: 'instance' }
  ]);
  await reconcileEntitiesQueue.addMany([
    { organizationId: organization.id, kind: 'user' },
    { organizationId: organization.id, kind: 'device' }
  ]);
});

export let reconcileScopesQueue = createQueue<{
  organizationId: string;
  type: 'project' | 'instance';
  cursor?: string;
}>({
  name: 'agent-telemetry/reconcile/scopes',
  workerOpts: { concurrency: 1 }
});

export let reconcileScopesQueueProcessor = reconcileScopesQueue.process(async data => {
  let where = {
    organization: { id: data.organizationId },
    id: data.cursor ? { gt: data.cursor } : undefined
  };
  let query = { where, orderBy: { id: 'asc' as const }, take: pageSize, select: { id: true } };

  let scopes =
    data.type == 'project'
      ? await db.project.findMany(query)
      : await db.instance.findMany(query);
  if (!scopes.length) return;

  await syncScopeQueue.addMany(scopes.map(scope => ({ type: data.type, id: scope.id })));

  if (scopes.length == pageSize) {
    await reconcileScopesQueue.add(
      { ...data, cursor: scopes[scopes.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

export let reconcileEntitiesQueue = createQueue<{
  organizationId: string;
  kind: keyof typeof syncedEntitySources;
  after?: string;
}>({
  name: 'agent-telemetry/reconcile/entities',
  workerOpts: { concurrency: 2, limiter: { max: 5, duration: 1000 } }
});

export let reconcileEntitiesQueueProcessor = reconcileEntitiesQueue.process(async data => {
  let groundstation = getGroundstation();
  if (!groundstation) return;

  let organization = await db.organization.findUnique({ where: { id: data.organizationId } });
  if (!organization || organization.status != 'active') return;

  let source = syncedEntitySources[data.kind];

  let page = await groundstation.entity.list({
    organizationId: organization.id,
    kinds: [data.kind],
    statuses: [...archivableStatuses],
    limit: entityPageSize,
    after: data.after
  });

  let synced = page.items.filter(item => item.source == source && item.ref);
  let refs = synced.map(item => item.ref!);

  let live =
    data.kind == 'user'
      ? await db.consumer.findMany({
          where: { id: { in: refs }, organizationOid: organization.oid },
          select: { id: true }
        })
      : await db.consumerDevice.findMany({
          where: {
            id: { in: refs },
            status: 'active',
            instance: { organizationOid: organization.oid }
          },
          select: { id: true }
        });
  let liveRefs = new Set(live.map(row => row.id));

  await Promise.all(
    synced
      .filter(item => !liveRefs.has(item.ref!))
      .map(item =>
        ignoreNotFound(
          groundstation.entity.archive({ organizationId: organization.id, entityId: item.id })
        )
      )
  );

  let last = page.items[page.items.length - 1];
  if (page.pagination.has_more_after && last) {
    await reconcileEntitiesQueue.add({ ...data, after: last.id }, dailyPacedDelay());
  }
});

export let reconcileQueueProcessor = combineQueueProcessors([
  reconcileCron,
  reconcileManyQueueProcessor,
  reconcileSingleQueueProcessor,
  reconcileScopesQueueProcessor,
  reconcileEntitiesQueueProcessor
]);
