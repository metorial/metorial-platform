import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { subDays } from 'date-fns';

export let RETENTION_BATCH_SIZE = 500;

export let getRetentionCutoffDate = (logRetentionInDays: number) =>
  subDays(new Date(), Math.max(logRetentionInDays, 0));

export let retentionPhaseBatch = async <Record>(d: {
  findMany: () => Promise<Record[]>;
  batchSize?: number;
  beforeDelete?: (records: Record[]) => Promise<void>;
  deleteMany: (records: Record[]) => Promise<unknown>;
}) => {
  let batchSize = d.batchSize ?? RETENTION_BATCH_SIZE;

  let records = await d.findMany();
  if (records.length === 0) return { deleted: 0, hasMore: false };

  if (d.beforeDelete) await d.beforeDelete(records);
  await d.deleteMany(records);

  return { deleted: records.length, hasMore: records.length === batchSize };
};

export interface RetentionPhaseResult {
  hasMore: boolean;
  cursor?: string;
}

export let createRetentionRunner = <TenantContext>(d: {
  name: string;
  cron?: string;
  redisUrl: string;

  listTenants: (args: { cursor?: string; take: number }) => Promise<{ id: string }[]>;
  getTenant: (tenantId: string) => Promise<TenantContext | null>;
  phases: Record<
    string,
    (tenant: TenantContext, cursor?: string) => Promise<RetentionPhaseResult>
  >;

  tenantWorkerOpts?: { concurrency: number; limiter?: { max: number; duration: number } };
  phaseWorkerOpts?: { concurrency: number; limiter?: { max: number; duration: number } };
}) => {
  let phaseNames = Object.keys(d.phases);

  let searchQueue = createQueue<{ cursor?: string }>({
    name: `${d.name}/search`,
    redisUrl: d.redisUrl,
    workerOpts: { concurrency: 1 }
  });

  let tenantQueue = createQueue<{ tenantId: string }>({
    name: `${d.name}/tenant`,
    redisUrl: d.redisUrl,
    workerOpts: d.tenantWorkerOpts ?? { concurrency: 2, limiter: { max: 2, duration: 1000 } }
  });

  let phaseQueue = createQueue<{ tenantId: string; phase: string; cursor?: string }>({
    name: `${d.name}/phase`,
    redisUrl: d.redisUrl,
    workerOpts: d.phaseWorkerOpts ?? { concurrency: 5, limiter: { max: 10, duration: 1000 } }
  });

  let cron = createCron(
    { name: `${d.name}/cron`, cron: d.cron ?? '0 0 * * *', redisUrl: d.redisUrl },
    async () => {
      await searchQueue.add({}, { id: 'search' });
    }
  );

  let searchProcessor = searchQueue.process(async data => {
    let tenants = await d.listTenants({ cursor: data.cursor, take: RETENTION_BATCH_SIZE });
    if (tenants.length === 0) return;

    await tenantQueue.addManyWithOps(
      tenants.map(tenant => ({ data: { tenantId: tenant.id }, opts: { id: tenant.id } }))
    );

    if (tenants.length === RETENTION_BATCH_SIZE) {
      await searchQueue.add({ cursor: tenants[tenants.length - 1]!.id }, dailyPacedDelay());
    }
  });

  let tenantProcessor = tenantQueue.process(async data => {
    let tenant = await d.getTenant(data.tenantId);
    if (!tenant) return;

    await phaseQueue.addManyWithOps(
      phaseNames.map((phase, index) => ({
        data: { tenantId: data.tenantId, phase },
        opts: { id: `${data.tenantId}:${phase}`, delay: index * 1_000 }
      }))
    );
  });

  let phaseProcessor = phaseQueue.process(async data => {
    let phase = d.phases[data.phase];
    if (!phase) return;

    let tenant = await d.getTenant(data.tenantId);
    if (!tenant) return;

    let { hasMore, cursor } = await phase(tenant, data.cursor);
    if (hasMore) {
      await phaseQueue.add(
        { tenantId: data.tenantId, phase: data.phase, cursor },
        dailyPacedDelay()
      );
    }
  });

  return {
    cron,
    searchQueue,
    tenantQueue,
    phaseQueue,
    searchProcessor,
    tenantProcessor,
    phaseProcessor,
    processors: combineQueueProcessors([
      cron,
      searchProcessor,
      tenantProcessor,
      phaseProcessor
    ])
  };
};
