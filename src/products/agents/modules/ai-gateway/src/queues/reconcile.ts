import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { isAiGatewayEnabled } from '../lib/client';
import { syncScopeQueue } from './syncScope';

let pageSize = 500;

export let reconcileCron = createCron(
  { name: 'ai-gateway/reconcile/cron', cron: '30 3 * * *', startupJitterMs: 60_000 },
  async () => {
    if (!isAiGatewayEnabled()) return;

    await reconcileManyQueue.add({});
  }
);

export let reconcileManyQueue = createQueue<{ cursor?: string }>({
  name: 'ai-gateway/reconcile/many',
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
  name: 'ai-gateway/reconcile/single',
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
});

export let reconcileScopesQueue = createQueue<{
  organizationId: string;
  type: 'project' | 'instance';
  cursor?: string;
}>({
  name: 'ai-gateway/reconcile/scopes',
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

export let reconcileQueueProcessor = combineQueueProcessors([
  reconcileCron,
  reconcileManyQueueProcessor,
  reconcileSingleQueueProcessor,
  reconcileScopesQueueProcessor
]);
