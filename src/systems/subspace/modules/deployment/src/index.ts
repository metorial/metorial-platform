import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';

export * from './services';

export let deploymentQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  deleteQueues
]);
