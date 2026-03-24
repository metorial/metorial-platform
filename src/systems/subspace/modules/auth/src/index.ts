import { combineQueueProcessors } from '@lowerdeck/queue';
import { cronQueues } from './queues/cron';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';

export * from './services';

export let authQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  cronQueues
]);
