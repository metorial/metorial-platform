import { createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import { env } from '../env';
import { runExportChunk } from '../lib/exportRun';
import { getExportStore } from '../lib/exportStore';

export let exportChunkQueue = createQueue<{ exportId: string }>({
  name: 'at/query/export/chunk',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

export let exportChunkProcessor = exportChunkQueue.process(async data => {
  let store = getExportStore();
  if (!store) return;

  let outcome = await runExportChunk({ exportId: data.exportId, store });
  if (outcome == 'yield') await exportChunkQueue.add(data, hourlyPacedDelay());
});
