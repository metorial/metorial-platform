import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { slatePackService } from '../../services/slatePack';

export let processSlatePackQueue = createQueue<{ packImportId: string }>({
  name: 'sreg/mirror/pack/process',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let processSlatePackProcessor = processSlatePackQueue.process(async data => {
  await slatePackService.processImport({ id: data.packImportId });
});
