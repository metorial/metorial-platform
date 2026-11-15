import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import {
  commitWatermarkScan,
  createQueueCheckpoint,
  enqueueWatermarkScan,
  type WatermarkScanJob
} from '@lowerdeck/queue-checkpoint';
import { db } from '@metorial-subspace/db';
import { activeRuleset } from '../definitions/rulesets';
import { env } from '../env';
import { protoGuardToolScanService } from '../internal/toolScan';

let PAGE_SIZE = 500;

let checkpoint = createQueueCheckpoint({ db, queue: 'sub/pg/tool/scan' });

export let toolScanCron = createCron(
  {
    name: 'sub/pg/tool/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '7-59/10 * * * *'
  },
  async () => {
    await enqueueWatermarkScan({ checkpoint, queue: toolScanManyQueue });
  }
);

let toolScanManyQueue = createQueue<WatermarkScanJob>({
  name: 'sub/pg/tool/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Tools already scanned under the active ruleset are filtered out here, so the weekly full pass
// only does real work after a ruleset version bump.
let toolScanManyProcessor = toolScanManyQueue.process(async job => {
  let tools = await db.providerTool.findMany({
    where: {
      ...(job.since ? { createdAt: { gte: new Date(job.since) } } : {}),
      ...(job.cursor ? { id: { gt: job.cursor } } : {}),
      protoGuardToolScans: { none: { rulesetVersion: activeRuleset.version } }
    },
    select: { oid: true, id: true },
    orderBy: { id: 'asc' },
    take: PAGE_SIZE
  });

  if (tools.length) {
    await toolScanSingleQueue.addManyWithOps(
      tools.map(tool => ({
        data: { providerToolOid: String(tool.oid) },
        opts: { id: `${tool.id}-${activeRuleset.version}` }
      }))
    );
  }

  if (tools.length == PAGE_SIZE) {
    await toolScanManyQueue.add(
      { ...job, cursor: tools[tools.length - 1]!.id },
      hourlyPacedDelay()
    );
    return;
  }

  await commitWatermarkScan({ checkpoint, job });
});

let toolScanSingleQueue = createQueue<{ providerToolOid: string }>({
  name: 'sub/pg/tool/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 50, duration: 1000 } }
});

let toolScanSingleProcessor = toolScanSingleQueue.process(async data => {
  await protoGuardToolScanService.scanProviderTool({
    providerToolOid: BigInt(data.providerToolOid)
  });
});

export let toolScanQueueProcessors = combineQueueProcessors([
  toolScanCron,
  toolScanManyProcessor,
  toolScanSingleProcessor
]);
