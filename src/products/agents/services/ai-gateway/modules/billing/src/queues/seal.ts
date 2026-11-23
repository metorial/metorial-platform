import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors } from '@lowerdeck/queue';
import { env } from '../env';
import { billingService } from '../services/billing';

let sealBillingWindowsCron = createCron(
  {
    name: 'aig/billing/seal/cron',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await billingService.sealWindows();
  }
);

export let billingQueueProcessor = combineQueueProcessors([sealBillingWindowsCron]);
