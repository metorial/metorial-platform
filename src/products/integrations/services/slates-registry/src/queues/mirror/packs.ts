import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { isMirrorMode } from '../../mode';
import { slatePackService } from '../../services/slatePack';
import { slatePackBatchService } from '../../services/slatePackBatch';

export let processSlatePackQueue = createQueue<{ packImportId: string }>({
  name: 'sreg/mirror/pack/process',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let processSlatePackProcessor = processSlatePackQueue.process(async data => {
  await slatePackService.processImport({ id: data.packImportId });
});

export let cleanupSlatePackBatchesCron = createCron(
  {
    name: 'sreg/mirror/pack/batch/cleanup',
    cron: '17 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (!isMirrorMode()) return;

    await slatePackBatchService.cleanupAbandonedBatches();
  }
);
